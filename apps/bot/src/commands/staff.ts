/** `/swap_as`, `/dm`, `/report` — прочие команды вышки. */
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { prisma, ensureSupport } from '../db.js';
import { routeLog } from '../lib/logRouter.js';
import { normalizeSlot } from '../lib/slots.js';
import { now, previousDay } from '../lib/time.js';
import { parseUserDate } from '../interactions/panel.js';
import { runDailyAudit, resetWeeklyMisses } from '../agents/cronReporter/index.js';
import type { BotCommand } from './types.js';

export const swapAsCommand: BotCommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('swap_as')
    .setDescription('Запросить замену от имени саппорта')
    .addUserOption((o) => o.setName('user').setDescription('Кого заменяем').setRequired(true))
    .addUserOption((o) => o.setName('substitute').setDescription('Кто заменит').setRequired(true))
    .addStringOption((o) =>
      o.setName('slot').setDescription('Слот (по умолчанию ПТ саппорта)').setRequired(false),
    )
    .addStringOption((o) =>
      o.setName('date').setDescription('Дата ДД.ММ.ГГГГ (по умолчанию сегодня)').setRequired(false),
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    const substitute = interaction.options.getUser('substitute', true);
    const slotRaw = interaction.options.getString('slot');
    const dateRaw = interaction.options.getString('date');

    if (target.id === substitute.id) {
      await interaction.reply({ content: '❌ Саппорт не может заменить сам себя.', ephemeral: true });
      return;
    }

    const user = await ensureSupport(target.id, target.username);
    await ensureSupport(substitute.id, substitute.username);

    const slot = slotRaw ? normalizeSlot(slotRaw) : user.primeSlot;
    if (!slot) {
      await interaction.reply({
        content: '❌ Слот не указан и у саппорта нет назначенного ПТ.',
        ephemeral: true,
      });
      return;
    }

    const day = dateRaw ? parseUserDate(dateRaw) : now().startOf('day');
    if (!day) {
      await interaction.reply({ content: '❌ Не понял дату. Формат: `ДД.ММ.ГГГГ`', ephemeral: true });
      return;
    }

    const date = day.startOf('day').toJSDate();

    await prisma.swapRequest.create({
      data: {
        requesterId: target.id,
        substituteId: substitute.id,
        slot,
        date,
        status: 'accepted',
      },
    });

    // Фиксируем ID замещающего саппорта в логе слота.
    await prisma.voiceLog.upsert({
      where: { userId_date_hourSlot: { userId: target.id, date, hourSlot: slot } },
      update: { substitutedBy: substitute.id },
      create: {
        userId: target.id,
        date,
        hourSlot: slot,
        substitutedBy: substitute.id,
        isVacation: user.isOnVacation,
      },
    });

    await prisma.supportUser.update({
      where: { id: substitute.id },
      data: { acceptedSwaps: { increment: 1 } },
    });

    const embed = new EmbedBuilder()
      .setTitle('\u{1F504} Замена оформлена')
      .setColor(0x3b82f6)
      .setDescription(`<@${substitute.id}> закрывает ПТ **${slot}** вместо <@${target.id}>.`)
      .addFields(
        { name: 'Дата', value: day.toFormat('dd.MM.yyyy'), inline: true },
        { name: 'Оформил', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp(new Date());

    await routeLog(interaction.client, 'swaps', { embeds: [embed] });
    await interaction.reply({
      content: `✅ Замена записана: <@${substitute.id}> вместо <@${target.id}> на **${slot}**.`,
      ephemeral: true,
    });
  },
};

export const dmCommand: BotCommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Отправить ЛС от имени бота')
    .addUserOption((o) => o.setName('user').setDescription('Кому').setRequired(true))
    .addStringOption((o) => o.setName('message').setDescription('Текст').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    const message = interaction.options.getString('message', true);

    try {
      await target.send(message);
      await routeLog(
        interaction.client,
        'news',
        `✉️ <@${interaction.user.id}> отправил ЛС <@${target.id}>.`,
      );
      await interaction.reply({ content: `✅ Сообщение отправлено <@${target.id}>.`, ephemeral: true });
    } catch {
      await interaction.reply({
        content: `❌ Не удалось отправить ЛС <@${target.id}> — вероятно, закрыты личные сообщения.`,
        ephemeral: true,
      });
    }
  },
};

export const reportCommand: BotCommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Служебные действия с отчётами')
    .addSubcommand((sub) =>
      sub
        .setName('run')
        .setDescription('Сформировать суточный отчёт вручную')
        .addStringOption((o) =>
          o.setName('date').setDescription('Дата ДД.ММ.ГГГГ (по умолчанию вчера)').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('reset_misses').setDescription('Сбросить счётчик прогулов у всех'),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    if (sub === 'reset_misses') {
      await resetWeeklyMisses(interaction.client);
      await interaction.editReply('✅ Счётчик прогулов сброшен.');
      return;
    }

    const dateRaw = interaction.options.getString('date');
    const day = dateRaw ? parseUserDate(dateRaw) : previousDay();
    if (!day) {
      await interaction.editReply('❌ Не понял дату. Формат: `ДД.ММ.ГГГГ`');
      return;
    }

    const result = await runDailyAudit(interaction.client, day);
    await interaction.editReply(
      `✅ Отчёт за **${day.toFormat('dd.MM.yyyy')}** опубликован. Прогульщиков: **${result.truants.length}**, ЛС доставлено: **${result.delivered}**.`,
    );
  },
};

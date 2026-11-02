/**
 * `/prime set|remove|list|add` и `/miss` — управление прайм-таймами.
 * Логи -> #логи > Прайм-таймы.
 */
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { DateTime } from 'luxon';
import { prisma, ensureSupport } from '../db.js';
import { config } from '../config.js';
import { routeLog } from '../lib/logRouter.js';
import { ALL_SLOTS, normalizeSlot } from '../lib/slots.js';
import { now } from '../lib/time.js';
import { parseUserDate } from '../interactions/panel.js';
import type { BotCommand } from './types.js';

export const primeCommand: BotCommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('prime')
    .setDescription('Прайм-таймы саппортов')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Назначить или сменить ПТ')
        .addUserOption((o) => o.setName('user').setDescription('Саппорт').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('time')
            .setDescription('Слот: 20, 20:00 или 20:00-21:00')
            .setRequired(true)
            .setAutocomplete(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Снять ПТ с саппорта')
        .addUserOption((o) => o.setName('user').setDescription('Саппорт').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Таблица распределения ПТ'))
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Вручную засчитать ПТ (по умолчанию за сегодня)')
        .addUserOption((o) => o.setName('user').setDescription('Саппорт').setRequired(true))
        .addStringOption((o) =>
          o.setName('date').setDescription('Дата ДД.ММ.ГГГГ (по умолчанию сегодня)').setRequired(false),
        )
        .addStringOption((o) =>
          o.setName('slot').setDescription('Слот (по умолчанию назначенный ПТ)').setRequired(false),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'set') return primeSet(interaction);
    if (sub === 'remove') return primeRemove(interaction);
    if (sub === 'list') return primeList(interaction);
    if (sub === 'add') return primeAdd(interaction);
  },
};

async function primeSet(interaction: Parameters<BotCommand['execute']>[0]) {
  const target = interaction.options.getUser('user', true);
  const raw = interaction.options.getString('time', true);
  const slot = normalizeSlot(raw);

  if (!slot) {
    await interaction.reply({
      content: '❌ Не понял слот. Примеры: `20`, `20:00`, `20:00-21:00`.',
      ephemeral: true,
    });
    return;
  }

  const user = await ensureSupport(target.id, target.username);
  const previous = user.primeSlot;

  await prisma.supportUser.update({ where: { id: target.id }, data: { primeSlot: slot } });

  await routeLog(
    interaction.client,
    'primes',
    previous
      ? `\u{1F504} <@${interaction.user.id}> сменил ПТ <@${target.id}>: **${previous}** → **${slot}**.`
      : `✅ <@${interaction.user.id}> назначил ПТ <@${target.id}>: **${slot}**.`,
  );

  await interaction.reply({
    content: `✅ ПТ <@${target.id}> — **${slot}**.`,
    ephemeral: true,
  });
}

async function primeRemove(interaction: Parameters<BotCommand['execute']>[0]) {
  const target = interaction.options.getUser('user', true);
  const user = await prisma.supportUser.findUnique({ where: { id: target.id } });

  if (!user?.primeSlot) {
    await interaction.reply({ content: 'ℹ️ У саппорта нет назначенного ПТ.', ephemeral: true });
    return;
  }

  await prisma.supportUser.update({ where: { id: target.id }, data: { primeSlot: null } });
  await routeLog(
    interaction.client,
    'primes',
    `⚫ <@${interaction.user.id}> снял ПТ **${user.primeSlot}** с <@${target.id}>.`,
  );
  await interaction.reply({ content: `✅ ПТ снят с <@${target.id}>.`, ephemeral: true });
}

async function primeList(interaction: Parameters<BotCommand['execute']>[0]) {
  const users = await prisma.supportUser.findMany({ where: { primeSlot: { not: null } } });

  const bySlot = new Map<string, string[]>();
  for (const user of users) {
    if (!user.primeSlot) continue;
    const list = bySlot.get(user.primeSlot) ?? [];
    list.push(`<@${user.id}>${user.isOnVacation ? ' \u{1F334}' : ''}`);
    bySlot.set(user.primeSlot, list);
  }

  const embed = new EmbedBuilder()
    .setTitle('\u{1F5D3}️ Распределение прайм-таймов')
    .setColor(0x8b5cf6)
    .setDescription(`Всего назначено: **${users.length}**`)
    .setTimestamp(new Date());

  for (const slot of ALL_SLOTS) {
    const holders = bySlot.get(slot);
    embed.addFields({
      name: slot,
      value: holders?.length ? holders.join('\n').slice(0, 1024) : 'Свободно',
      inline: true,
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function primeAdd(interaction: Parameters<BotCommand['execute']>[0]) {
  const target = interaction.options.getUser('user', true);
  const dateRaw = interaction.options.getString('date');
  const slotRaw = interaction.options.getString('slot');

  const day: DateTime | null = dateRaw ? parseUserDate(dateRaw) : now().startOf('day');
  if (!day) {
    await interaction.reply({ content: '❌ Не понял дату. Формат: `ДД.ММ.ГГГГ`', ephemeral: true });
    return;
  }

  const user = await ensureSupport(target.id, target.username);
  const slot = slotRaw ? normalizeSlot(slotRaw) : user.primeSlot;

  if (!slot) {
    await interaction.reply({
      content: '❌ Слот не указан и у саппорта нет назначенного ПТ.',
      ephemeral: true,
    });
    return;
  }

  const date = day.startOf('day').toJSDate();
  const isAssigned = user.primeSlot === slot;

  await prisma.voiceLog.upsert({
    where: { userId_date_hourSlot: { userId: target.id, date, hourSlot: slot } },
    update: {
      minutesSpent: Math.max(config.PRIME_SLOT_MINUTES, config.PRIME_PASS_MINUTES),
      isCompleted: true,
      manual: true,
    },
    create: {
      userId: target.id,
      date,
      hourSlot: slot,
      minutesSpent: config.PRIME_SLOT_MINUTES,
      isCompleted: true,
      manual: true,
      isExtra: !isAssigned,
      isShield: isAssigned && !user.shieldUsed,
      isVacation: user.isOnVacation,
    },
  });

  await routeLog(
    interaction.client,
    'primes',
    `✅ <@${interaction.user.id}> вручную засчитал ПТ <@${target.id}>: **${slot}** за **${day.toFormat('dd.MM.yyyy')}**.`,
  );

  await interaction.reply({
    content: `✅ ПТ **${slot}** засчитан <@${target.id}> за **${day.toFormat('dd.MM.yyyy')}**.`,
    ephemeral: true,
  });
}

export const missCommand: BotCommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('miss')
    .setDescription('Вычесть прогул из счётчика [N]')
    .addUserOption((o) => o.setName('user').setDescription('Саппорт').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('count').setDescription('Сколько вычесть (по умолчанию 1)').setMinValue(1).setRequired(false),
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    const count = interaction.options.getInteger('count') ?? 1;

    const user = await ensureSupport(target.id, target.username);
    const next = Math.max(0, user.weeklyMisses - count);

    const updated = await prisma.supportUser.update({
      where: { id: target.id },
      data: { weeklyMisses: next },
    });

    await routeLog(
      interaction.client,
      'reports',
      `➖ <@${interaction.user.id}> вычел прогул(ы) у <@${target.id}>: [${user.weeklyMisses}] → [${updated.weeklyMisses}].`,
    );

    await interaction.reply({
      content: `✅ Счётчик прогулов <@${target.id}>: **[${updated.weeklyMisses}]**.`,
      ephemeral: true,
    });
  },
};

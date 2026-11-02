/** `/award` и `/take` — управление токенами. Логи -> #логи > Токены. */
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { prisma, ensureSupport } from '../db.js';
import { routeLog } from '../lib/logRouter.js';
import type { BotCommand } from './types.js';

const amountOption = (name = 'amount') => (opt: any) =>
  opt.setName(name).setDescription('Количество токенов').setMinValue(1).setRequired(true);

export const awardCommand: BotCommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('award')
    .setDescription('Выдать токены саппорту')
    .addUserOption((o) => o.setName('user').setDescription('Кому').setRequired(true))
    .addIntegerOption(amountOption())
    .addStringOption((o) => o.setName('reason').setDescription('Причина').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const reason = interaction.options.getString('reason') ?? 'без причины';

    await ensureSupport(target.id, target.username);
    const updated = await prisma.supportUser.update({
      where: { id: target.id },
      data: { tokens: { increment: amount } },
    });

    const embed = new EmbedBuilder()
      .setTitle('\u{1FA99} Начисление токенов')
      .setColor(0x22c55e)
      .setDescription(`<@${target.id}> получил **+${amount}** токенов.`)
      .addFields(
        { name: 'Причина', value: reason, inline: false },
        { name: 'Новый баланс', value: `${updated.tokens}`, inline: true },
        { name: 'Выдал', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp(new Date());

    await routeLog(interaction.client, 'tokens', { embeds: [embed] });
    await interaction.reply({
      content: `✅ <@${target.id}>: **+${amount}** токенов. Баланс: **${updated.tokens}**.`,
      ephemeral: true,
    });
  },
};

export const takeCommand: BotCommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('take')
    .setDescription('Забрать токены у саппорта')
    .addUserOption((o) => o.setName('user').setDescription('У кого').setRequired(true))
    .addIntegerOption(amountOption())
    .addStringOption((o) => o.setName('reason').setDescription('Причина').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const reason = interaction.options.getString('reason') ?? 'без причины';

    const user = await ensureSupport(target.id, target.username);
    const next = Math.max(0, user.tokens - amount);
    const updated = await prisma.supportUser.update({
      where: { id: target.id },
      data: { tokens: next },
    });

    const embed = new EmbedBuilder()
      .setTitle('\u{1FA99} Списание токенов')
      .setColor(0xef4444)
      .setDescription(`У <@${target.id}> списано **-${user.tokens - next}** токенов.`)
      .addFields(
        { name: 'Причина', value: reason, inline: false },
        { name: 'Новый баланс', value: `${updated.tokens}`, inline: true },
        { name: 'Списал', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp(new Date());

    await routeLog(interaction.client, 'tokens', { embeds: [embed] });
    await interaction.reply({
      content: `✅ <@${target.id}>: **-${user.tokens - next}** токенов. Баланс: **${updated.tokens}**.`,
      ephemeral: true,
    });
  },
};

/**
 * Кнопка «Объясниться» -> модальное окно -> объяснительная в #логи > Отчёты.
 * Часть cron_reporter_agent (пункты 4–5 ТЗ).
 */
import {
  ActionRowBuilder,
  type ButtonInteraction,
  EmbedBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { DateTime } from 'luxon';
import { prisma, ensureSupport } from '../db.js';
import { config } from '../config.js';
import { routeLog } from '../lib/logRouter.js';
import { EXPLAIN_INPUT, EXPLAIN_MODAL_PREFIX, parseId } from './ids.js';

export async function openExplainModal(interaction: ButtonInteraction) {
  const { args } = parseId(interaction.customId);
  const [isoDate, slot] = args;

  const modal = new ModalBuilder()
    .setCustomId(`${EXPLAIN_MODAL_PREFIX}:${isoDate}:${slot}`)
    .setTitle(`Объяснительная · ${slot}`.slice(0, 45));

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(EXPLAIN_INPUT)
        .setLabel('Почему не был(а) на прайм-тайме?')
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(5)
        .setMaxLength(1000)
        .setRequired(true)
        .setPlaceholder('Опиши причину как можно подробнее'),
    ),
  );

  await interaction.showModal(modal);
}

export async function submitExplainModal(interaction: ModalSubmitInteraction) {
  const { args } = parseId(interaction.customId);
  const [isoDate, slot] = args;
  const text = interaction.fields.getTextInputValue(EXPLAIN_INPUT);

  await ensureSupport(interaction.user.id, interaction.user.username);

  const date = isoDate
    ? DateTime.fromISO(isoDate, { zone: config.TIMEZONE }).startOf('day').toJSDate()
    : new Date();

  const record = await prisma.explanation.create({
    data: { userId: interaction.user.id, slot: slot ?? '—', date, text },
  });

  const embed = new EmbedBuilder()
    .setTitle('\u{1F4DD} Объяснительная')
    .setColor(0xf59e0b)
    .setDescription(text)
    .addFields(
      { name: 'Саппорт', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Прайм-тайм', value: slot ?? '—', inline: true },
      { name: 'Дата ПТ', value: isoDate || '—', inline: true },
    )
    .setTimestamp(new Date());

  const sent = await routeLog(interaction.client, 'reports', { embeds: [embed] });
  if (sent) {
    await prisma.explanation.update({ where: { id: record.id }, data: { sentToLogs: true } });
  }

  await interaction.reply({
    content: '✅ Объяснительная отправлена вышке. Спасибо!',
    ephemeral: true,
  });
}

/**
 * Интерактивная админ-панель `/admin panel @саппорт` (ephemeral).
 * Цвета кнопок отражают состояние: Success = включено, Secondary = выключено.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type InteractionReplyOptions,
} from 'discord.js';
import type { SupportUser } from '@prisma/client';
import { fmtDate, fmtDateShort } from '../../lib/time.js';
import {
  PANEL_DELETE,
  PANEL_JOINDATE,
  PANEL_PROBATION,
  PANEL_VACATION,
} from '../../interactions/ids.js';

export async function buildPanel(client: Client, user: SupportUser): Promise<InteractionReplyOptions> {
  const discordUser = await client.users.fetch(user.id).catch(() => null);

  const embed = new EmbedBuilder()
    .setTitle(`Админ панель — ${user.username}`)
    .setColor(0x8b5cf6)
    .setDescription(
      [
        `**Прайм-тайм:** ${user.primeSlot ?? 'не назначен'}`,
        `**Дата принятия:** ${fmtDate(user.joinDate)}`,
        `**Баланс:** ${user.tokens} \u{1FA99}`,
      ].join('\n'),
    )
    .addFields(
      {
        name: 'Исп. срок',
        value: user.isProbation
          ? `\u{1F7E2} до ${user.probationEnd ? fmtDateShort(user.probationEnd) : '—'}`
          : '⚫ нет',
        inline: true,
      },
      {
        name: 'Отпуск',
        value: user.isOnVacation
          ? `\u{1F7E2} до ${user.vacationUntil ? fmtDateShort(user.vacationUntil) : '—'}`
          : '⚫ нет',
        inline: true,
      },
      { name: 'Прогулы за неделю', value: `[${user.weeklyMisses}]`, inline: true },
      { name: 'Выговоры', value: `${user.warnings}`, inline: true },
      { name: 'Минут в войсах', value: `${user.totalVoiceMinutes}`, inline: true },
      { name: 'Принятых замен', value: `${user.acceptedSwaps}`, inline: true },
    );

  if (discordUser) embed.setThumbnail(discordUser.displayAvatarURL({ size: 256 }));

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PANEL_JOINDATE}:${user.id}`)
      .setLabel('Дата принятия')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${PANEL_PROBATION}:${user.id}`)
      .setLabel('Исп. срок')
      .setStyle(user.isProbation ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${PANEL_VACATION}:${user.id}`)
      .setLabel('Отпуск')
      .setStyle(user.isOnVacation ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PANEL_DELETE}:${user.id}`)
      .setLabel('Удалить из БД')
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row1, row2], ephemeral: true };
}

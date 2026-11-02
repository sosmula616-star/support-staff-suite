/**
 * Обработчики кнопок и модалок админ-панели (admin_control_agent).
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  EmbedBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { DateTime } from 'luxon';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { routeLog } from '../lib/logRouter.js';
import { buildPanel } from '../agents/adminControl/panel.js';
import { fmtDate } from '../lib/time.js';
import {
  PANEL_DELETE_CANCEL,
  PANEL_DELETE_CONFIRM,
  PANEL_JOINDATE_INPUT,
  PANEL_JOINDATE_MODAL,
  PANEL_VACATION_INPUT,
  PANEL_VACATION_MODAL,
  parseId,
} from './ids.js';

const DEFAULT_PROBATION_DAYS = 7;

/** Парсит ДД.ММ.ГГГГ / ДД.ММ.ГГ / ГГГГ-ММ-ДД. */
export function parseUserDate(input: string): DateTime | null {
  const value = input.trim();
  for (const format of ['dd.MM.yyyy', 'dd.MM.yy', 'yyyy-MM-dd', 'dd/MM/yyyy']) {
    const dt = DateTime.fromFormat(value, format, { zone: config.TIMEZONE });
    if (dt.isValid) return dt.startOf('day');
  }
  return null;
}

async function getUser(id: string) {
  return prisma.supportUser.findUnique({ where: { id } });
}

async function refresh(interaction: ButtonInteraction | ModalSubmitInteraction, id: string) {
  const user = await getUser(id);
  if (!user) {
    await interaction.editReply({
      content: '❌ Саппорт удалён из БД.',
      embeds: [],
      components: [],
    });
    return;
  }
  const panel = await buildPanel(interaction.client, user);
  await interaction.editReply({
    embeds: panel.embeds,
    components: panel.components,
    content: null,
  });
}

/* ───────────── Дата принятия ───────────── */

export async function openJoinDateModal(interaction: ButtonInteraction) {
  const [id] = parseId(interaction.customId).args;
  const user = await getUser(id);

  const modal = new ModalBuilder()
    .setCustomId(`${PANEL_JOINDATE_MODAL}:${id}`)
    .setTitle('Дата принятия в стафф');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(PANEL_JOINDATE_INPUT)
        .setLabel('Дата (ДД.ММ.ГГГГ)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(user ? fmtDate(user.joinDate) : '01.01.2026')
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

export async function submitJoinDateModal(interaction: ModalSubmitInteraction) {
  const [id] = parseId(interaction.customId).args;
  const parsed = parseUserDate(interaction.fields.getTextInputValue(PANEL_JOINDATE_INPUT));

  if (!parsed) {
    await interaction.reply({
      content: '❌ Не понял дату. Формат: `ДД.ММ.ГГГГ`',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();
  await prisma.supportUser.update({ where: { id }, data: { joinDate: parsed.toJSDate() } });
  await routeLog(
    interaction.client,
    'news',
    `\u{1F4C5} <@${interaction.user.id}> изменил дату принятия <@${id}> на **${parsed.toFormat('dd.MM.yyyy')}**.`,
  );
  await refresh(interaction, id);
}

/* ───────────── Испытательный срок (тоггл) ───────────── */

export async function toggleProbation(interaction: ButtonInteraction) {
  const [id] = parseId(interaction.customId).args;
  await interaction.deferUpdate();

  const user = await getUser(id);
  if (!user) {
    await refresh(interaction, id);
    return;
  }

  if (user.isProbation) {
    await prisma.supportUser.update({
      where: { id },
      data: { isProbation: false, probationEnd: null },
    });
    await routeLog(
      interaction.client,
      'news',
      `⚫ <@${interaction.user.id}> снял исп. срок с <@${id}>.`,
    );
  } else {
    const end = DateTime.now()
      .setZone(config.TIMEZONE)
      .plus({ days: DEFAULT_PROBATION_DAYS })
      .startOf('day');
    await prisma.supportUser.update({
      where: { id },
      data: { isProbation: true, probationEnd: end.toJSDate() },
    });
    await routeLog(
      interaction.client,
      'news',
      `\u{1F7E2} <@${interaction.user.id}> выдал исп. срок <@${id}> до **${end.toFormat('dd.MM.yyyy')}** (${DEFAULT_PROBATION_DAYS} дн.).`,
    );
  }

  await refresh(interaction, id);
}

/* ───────────── Отпуск (тоггл + модалка) ───────────── */

export async function toggleVacation(interaction: ButtonInteraction) {
  const [id] = parseId(interaction.customId).args;
  const user = await getUser(id);
  if (!user) {
    await interaction.reply({ content: '❌ Саппорт не найден.', ephemeral: true });
    return;
  }

  // Отпуск активен (зелёная кнопка) -> клик отменяет отпуск.
  if (user.isOnVacation) {
    await interaction.deferUpdate();
    await prisma.supportUser.update({
      where: { id },
      data: { isOnVacation: false, vacationUntil: null },
    });
    await routeLog(
      interaction.client,
      'news',
      `⚫ <@${interaction.user.id}> отменил отпуск <@${id}>.`,
    );
    await refresh(interaction, id);
    return;
  }

  // Отпуска нет (серая кнопка) -> модалка с датой окончания.
  const modal = new ModalBuilder()
    .setCustomId(`${PANEL_VACATION_MODAL}:${id}`)
    .setTitle('Отпуск саппорта');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(PANEL_VACATION_INPUT)
        .setLabel('Отпуск до (ДД.ММ.ГГГГ)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('01.01.2026')
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

export async function submitVacationModal(interaction: ModalSubmitInteraction) {
  const [id] = parseId(interaction.customId).args;
  const parsed = parseUserDate(interaction.fields.getTextInputValue(PANEL_VACATION_INPUT));

  if (!parsed) {
    await interaction.reply({
      content: '❌ Не понял дату. Формат: `ДД.ММ.ГГГГ`',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();
  await prisma.supportUser.update({
    where: { id },
    data: { isOnVacation: true, vacationUntil: parsed.endOf('day').toJSDate() },
  });
  await routeLog(
    interaction.client,
    'news',
    `\u{1F334} <@${interaction.user.id}> выдал отпуск <@${id}> до **${parsed.toFormat('dd.MM.yyyy')}**.`,
  );
  await refresh(interaction, id);
}

/* ───────────── Удаление из БД ───────────── */

export async function askDelete(interaction: ButtonInteraction) {
  const [id] = parseId(interaction.customId).args;

  const embed = new EmbedBuilder()
    .setTitle('⚠️ Подтверждение удаления')
    .setColor(0xef4444)
    .setDescription(
      `Удалить <@${id}> из базы? Вместе с записью удалятся все ПТ-логи, объяснительные и токены. Действие необратимо.`,
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PANEL_DELETE_CONFIRM}:${id}`)
      .setLabel('Да, удалить')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${PANEL_DELETE_CANCEL}:${id}`)
      .setLabel('Отмена')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

export async function confirmDelete(interaction: ButtonInteraction) {
  const [id] = parseId(interaction.customId).args;
  await interaction.deferUpdate();

  await prisma.supportUser.delete({ where: { id } }).catch(() => undefined);
  await routeLog(
    interaction.client,
    'removals',
    `\u{1F5D1}️ <@${interaction.user.id}> удалил <@${id}> из БД.`,
  );

  await interaction.editReply({
    content: `✅ <@${id}> удалён из базы.`,
    embeds: [],
    components: [],
  });
}

export async function cancelDelete(interaction: ButtonInteraction) {
  const [id] = parseId(interaction.customId).args;
  await interaction.deferUpdate();
  await refresh(interaction, id);
}

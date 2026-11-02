/**
 * ──────────────────────────────────────────────────────────────
 *  АГЕНТ 2 — cron_reporter_agent
 *  Фоновые задачи, суточный аудит и сводки ровно в 0:00.
 *
 *  0:00 ежедневно:
 *    1. отчёт по 24 слотам -> #логи > Отчёты
 *    2. список прогульщиков сразу под отчётом
 *    3. ЛС каждому прогульщику с кнопкой «Объясниться»
 *    4. инкремент счётчика прогулов [N]
 *  0:00 понедельника: сброс weeklyMisses.
 * ──────────────────────────────────────────────────────────────
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  EmbedBuilder,
} from 'discord.js';
import cron from 'node-cron';
import type { DateTime } from 'luxon';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { createLogger } from '../../logger.js';
import { routeLog } from '../../lib/logRouter.js';
import { previousDay, now } from '../../lib/time.js';
import {
  buildDayReport,
  buildTruants,
  renderReportEmbed,
  renderTruantsEmbed,
  type Truant,
} from './report.js';
import { EXPLAIN_BUTTON_PREFIX } from '../../interactions/ids.js';

const log = createLogger('cron_reporter_agent');

export function registerCronReporter(client: Client) {
  // Суточный отчёт — ровно в 0:00 по TIMEZONE.
  cron.schedule(
    '0 0 * * *',
    () => {
      runDailyAudit(client).catch((err) => log.error('ошибка суточного аудита:', err));
    },
    { timezone: config.TIMEZONE },
  );

  // Еженедельный сброс счётчика прогулов — в 0:00 понедельника, после отчёта.
  cron.schedule(
    `1 0 * * ${config.WEEKLY_RESET_DAY}`,
    () => {
      resetWeeklyMisses(client).catch((err) => log.error('ошибка недельного сброса:', err));
    },
    { timezone: config.TIMEZONE },
  );

  // Окончание отпусков / испытательных сроков — раз в час.
  cron.schedule(
    '5 * * * *',
    () => {
      expireStatuses(client).catch((err) => log.error('ошибка снятия статусов:', err));
    },
    { timezone: config.TIMEZONE },
  );

  log.info(`крон запущен (TZ=${config.TIMEZONE}), отчёт в 0:00, сброс прогулов в день ${config.WEEKLY_RESET_DAY}`);
}

/** Полный аудит суток. Вызывается кроном и командой /report run. */
export async function runDailyAudit(client: Client, day: DateTime = previousDay()) {
  log.info(`аудит за ${day.toISODate()}`);

  // 1. Отчёт по 24 слотам
  const reports = await buildDayReport(day);
  await routeLog(client, 'reports', { embeds: [renderReportEmbed(day, reports)] });

  // 2. Прогульщики (считаем ДО инкремента, затем инкрементим и показываем свежее [N])
  const truants = await buildTruants(day);
  for (const truant of truants) {
    const updated = await prisma.supportUser.update({
      where: { id: truant.userId },
      data: { weeklyMisses: { increment: 1 } },
    });
    truant.misses = updated.weeklyMisses;
  }

  await routeLog(client, 'reports', { embeds: [renderTruantsEmbed(truants)] });

  // 3. Рассылка в ЛС
  let delivered = 0;
  for (const truant of truants) {
    if (await sendExplanationDm(client, truant, day.toISODate() ?? '')) delivered += 1;
  }

  log.info(`аудит готов: слотов 24, прогульщиков ${truants.length}, ЛС доставлено ${delivered}`);
  return { reports, truants, delivered };
}

/** ЛС прогульщику с кнопкой «Объясниться». */
async function sendExplanationDm(client: Client, truant: Truant, isoDate: string): Promise<boolean> {
  const user = await client.users.fetch(truant.userId).catch(() => null);
  if (!user) return false;

  const embed = new EmbedBuilder()
    .setTitle('Привет!')
    .setColor(0x8b5cf6)
    .setDescription(
      [
        'Пожалуйста, объяснись, почему ты не досидел(а) следующие прайм-таймы:',
        '',
        `**${truant.slot}** —`,
        '```',
        `${truant.minutes} минут из требуемых ${config.PRIME_SLOT_MINUTES}`,
        '```',
      ].join('\n'),
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${EXPLAIN_BUTTON_PREFIX}:${isoDate}:${truant.slot}`)
      .setLabel('Объясниться')
      .setStyle(ButtonStyle.Primary),
  );

  try {
    await user.send({ embeds: [embed], components: [row] });
    return true;
  } catch {
    log.warn(`ЛС закрыты у ${truant.userId}`);
    return false;
  }
}

/** Еженедельный сброс счётчика прогулов [N]. */
export async function resetWeeklyMisses(client: Client) {
  const { count } = await prisma.supportUser.updateMany({ data: { weeklyMisses: 0 } });
  log.info(`недельный сброс прогулов: ${count} записей`);
  await routeLog(
    client,
    'reports',
    `\u{1F504} Счётчик прогулов сброшен на новую неделю (обновлено записей: **${count}**).`,
  );
}

/** Автоснятие отпуска и испытательного срока по истечении даты. */
async function expireStatuses(client: Client) {
  const current = now().toJSDate();

  const vacations = await prisma.supportUser.findMany({
    where: { isOnVacation: true, vacationUntil: { not: null, lte: current } },
  });
  for (const user of vacations) {
    await prisma.supportUser.update({
      where: { id: user.id },
      data: { isOnVacation: false, vacationUntil: null },
    });
    await routeLog(client, 'news', `\u{1F334} Отпуск <@${user.id}> завершён — саппорт снова в строю.`);
  }

  const probations = await prisma.supportUser.findMany({
    where: { isProbation: true, probationEnd: { not: null, lte: current } },
  });
  for (const user of probations) {
    await prisma.supportUser.update({
      where: { id: user.id },
      data: { isProbation: false, probationEnd: null },
    });
    await routeLog(client, 'news', `✅ Испытательный срок <@${user.id}> завершён.`);
  }
}

/**
 * ──────────────────────────────────────────────────────────────
 *  АГЕНТ 1 — voice_tracker_agent
 *  Мониторинг голосовой активности в канале «Лаундж».
 *
 *  Правило: ПТ засчитан, если за назначенный часовой слот саппорт
 *  отсидел >= PRIME_PASS_MINUTES (по умолчанию 47) минут.
 *  Всё, что меньше — прогул.
 * ──────────────────────────────────────────────────────────────
 */
import { type Client, Events, type VoiceState } from 'discord.js';
import { DateTime } from 'luxon';
import { prisma, ensureSupport } from '../../db.js';
import { config } from '../../config.js';
import { createLogger } from '../../logger.js';
import { slotOf, slotBounds } from '../../lib/slots.js';
import { now } from '../../lib/time.js';

const log = createLogger('voice_tracker_agent');

/** Как часто сбрасываем накопленные минуты активных сидельцев в БД. */
const FLUSH_INTERVAL_MS = 60_000;

export function registerVoiceTracker(client: Client) {
  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    handleVoiceStateUpdate(oldState, newState).catch((err) =>
      log.error('ошибка обработки VoiceStateUpdate:', err),
    );
  });

  client.once(Events.ClientReady, () => {
    syncOnStartup(client).catch((err) => log.error('ошибка стартовой синхронизации:', err));
    setInterval(() => {
      flushActiveSessions(client).catch((err) => log.error('ошибка flush:', err));
    }, FLUSH_INTERVAL_MS);
    log.info(`трекинг канала ${config.LOUNGE_VOICE_CHANNEL_ID}, порог ${config.PRIME_PASS_MINUTES} мин.`);
  });
}

/** Подхватываем тех, кто уже сидит в лаундже на момент запуска бота. */
async function syncOnStartup(client: Client) {
  const channel = await client.channels.fetch(config.LOUNGE_VOICE_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isVoiceBased()) {
    log.warn('LOUNGE_VOICE_CHANNEL_ID не указывает на голосовой канал');
    return;
  }
  await prisma.voiceSession.deleteMany({ where: { channelId: channel.id } });
  for (const [, member] of channel.members) {
    if (member.user.bot) continue;
    await ensureSupport(member.id, member.user.username);
    await openSession(member.id, channel.id);
  }
  log.info(`стартовая синхронизация: ${channel.members.size} в канале`);
}

async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  const target = config.LOUNGE_VOICE_CHANNEL_ID;
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  const left = oldState.channelId === target && newState.channelId !== target;
  const joined = newState.channelId === target && oldState.channelId !== target;

  if (joined) {
    await ensureSupport(member.id, member.user.username);
    await openSession(member.id, target);
    log.debug(`+ ${member.user.username} зашёл в лаундж`);
  }

  if (left) {
    await closeSession(member.id, target);
    log.debug(`- ${member.user.username} вышел из лаунджа`);
  }
}

async function openSession(userId: string, channelId: string) {
  await prisma.voiceSession.upsert({
    where: { userId_channelId: { userId, channelId } },
    update: { joinedAt: new Date() },
    create: { userId, channelId, joinedAt: new Date() },
  });
}

async function closeSession(userId: string, channelId: string) {
  const session = await prisma.voiceSession.findUnique({
    where: { userId_channelId: { userId, channelId } },
  });
  if (!session) return;
  await creditTime(userId, DateTime.fromJSDate(session.joinedAt).setZone(config.TIMEZONE), now());
  await prisma.voiceSession.delete({ where: { id: session.id } }).catch(() => undefined);
}

/**
 * Периодический сброс: минуты начисляются «на лету», чтобы отчёт в 0:00
 * был корректным даже для тех, кто не вышел из канала.
 */
async function flushActiveSessions(client: Client) {
  const sessions = await prisma.voiceSession.findMany({
    where: { channelId: config.LOUNGE_VOICE_CHANNEL_ID },
  });
  if (!sessions.length) return;

  const current = now();
  for (const session of sessions) {
    const from = DateTime.fromJSDate(session.joinedAt).setZone(config.TIMEZONE);
    if (current.diff(from, 'minutes').minutes < 1) continue;
    await creditTime(session.userId, from, current);
    await prisma.voiceSession.update({
      where: { id: session.id },
      data: { joinedAt: current.toJSDate() },
    });
  }
  void client;
}

/**
 * Разносит отрезок [from, to] по часовым слотам и начисляет минуты.
 * Отрезок может пересекать границу часа и даже суток.
 */
export async function creditTime(userId: string, from: DateTime, to: DateTime) {
  if (to <= from) return;

  let cursor = from;
  while (cursor < to) {
    const slot = slotOf(cursor);
    const { end } = slotBounds(slot, cursor);
    const segmentEnd = to < end ? to : end;
    const minutes = Math.floor(segmentEnd.diff(cursor, 'minutes').minutes);

    if (minutes > 0) {
      await addMinutes(userId, cursor.startOf('day'), slot, minutes);
    }
    cursor = segmentEnd.plus({ milliseconds: 1 });
    if (segmentEnd.equals(end)) cursor = end;
  }
}

/** Начисляет минуты в VoiceLog и пересчитывает флаги/статусы. */
export async function addMinutes(userId: string, day: DateTime, slot: string, minutes: number) {
  const user = await prisma.supportUser.findUnique({ where: { id: userId } });
  if (!user) return;

  const date = day.startOf('day').toJSDate();
  const existing = await prisma.voiceLog.findUnique({
    where: { userId_date_hourSlot: { userId, date, hourSlot: slot } },
  });

  const total = (existing?.minutesSpent ?? 0) + minutes;
  const isAssignedSlot = user.primeSlot === slot;

  const data = {
    minutesSpent: total,
    isCompleted: total >= config.PRIME_PASS_MINUTES,
    isVacation: user.isOnVacation,
    // ⚡ Молния — время вне назначенного ПТ, т.е. доп. смена.
    isExtra: !isAssignedSlot,
    // 🛡️ Щит — первый ПТ саппорта после вступления в стафф.
    isShield: isAssignedSlot && !user.shieldUsed,
  };

  if (existing) {
    await prisma.voiceLog.update({ where: { id: existing.id }, data });
  } else {
    await prisma.voiceLog.create({ data: { userId, date, hourSlot: slot, ...data } });
  }

  await prisma.supportUser.update({
    where: { id: userId },
    data: { totalVoiceMinutes: { increment: minutes } },
  });
}

/** Сколько минут саппорт отсидел в конкретном слоте конкретных суток. */
export async function minutesInSlot(userId: string, day: DateTime, slot: string): Promise<number> {
  const entry = await prisma.voiceLog.findUnique({
    where: { userId_date_hourSlot: { userId, date: day.startOf('day').toJSDate(), hourSlot: slot } },
  });
  return entry?.minutesSpent ?? 0;
}

export const PASS_MINUTES = config.PRIME_PASS_MINUTES;

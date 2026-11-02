import { EmbedBuilder, type Client } from 'discord.js';
import type { DateTime } from 'luxon';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { ALL_SLOTS } from '../../lib/slots.js';
import { flagSuffix } from '../../lib/flags.js';
import { fmtDate } from '../../lib/time.js';

export interface SlotEntry {
  userId: string;
  minutes: number;
  completed: boolean;
  suffix: string;
}

export interface SlotReport {
  slot: string;
  entries: SlotEntry[];
}

export interface Truant {
  userId: string;
  slot: string;
  minutes: number;
  misses: number;
}

/** Собирает срез по всем 24 слотам за указанные сутки. */
export async function buildDayReport(day: DateTime): Promise<SlotReport[]> {
  const date = day.startOf('day').toJSDate();

  const [logs, assigned] = await Promise.all([
    prisma.voiceLog.findMany({ where: { date }, orderBy: { minutesSpent: 'desc' } }),
    prisma.supportUser.findMany({ where: { primeSlot: { not: null } } }),
  ]);

  const bySlot = new Map<string, SlotEntry[]>();
  for (const slot of ALL_SLOTS) bySlot.set(slot, []);

  for (const entry of logs) {
    const bucket = bySlot.get(entry.hourSlot);
    if (!bucket) continue;
    bucket.push({
      userId: entry.userId,
      minutes: entry.minutesSpent,
      completed: entry.isCompleted,
      suffix: flagSuffix(entry),
    });
  }

  // Назначенные ПТ, по которым вообще нет записи — это 0 минут, а не «Свободно».
  for (const user of assigned) {
    if (!user.primeSlot) continue;
    const bucket = bySlot.get(user.primeSlot);
    if (!bucket) continue;
    if (bucket.some((e) => e.userId === user.id)) continue;
    bucket.push({
      userId: user.id,
      minutes: 0,
      completed: false,
      suffix: user.isOnVacation ? ' \u{1F334}' : '',
    });
  }

  return ALL_SLOTS.map((slot) => ({ slot, entries: bySlot.get(slot) ?? [] }));
}

/** Строка одного слота: `[✓ - 48] @user 🛡️` либо `Свободно`. */
export function renderSlot(report: SlotReport): string {
  if (!report.entries.length) return 'Свободно';
  return report.entries
    .map((e) => `[${e.completed ? '✓' : '✗'} - ${e.minutes}] <@${e.userId}>${e.suffix}`)
    .join('\n');
}

/** Эмбед «📊 Активность за прошедшие сутки» — сетка 24 слотов в 3 колонки. */
export function renderReportEmbed(day: DateTime, reports: SlotReport[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('\u{1F4CA} Активность за прошедшие сутки')
    .setDescription(`Отчёт за **${fmtDate(day)}** · порог засчёта — **${config.PRIME_PASS_MINUTES} мин.**`)
    .setColor(0x8b5cf6)
    .setTimestamp(new Date());

  for (const report of reports) {
    embed.addFields({ name: report.slot, value: truncate(renderSlot(report)), inline: true });
  }

  embed.setFooter({
    text: `\u{1F334} отпуск · \u{1F6E1}️ щит · ⚡ доп. ПТ · (замена) — закрыл другой саппорт`,
  });

  return embed;
}

/** Прогульщики: назначенный ПТ есть, минут меньше порога, отпуска нет. */
export async function buildTruants(day: DateTime): Promise<Truant[]> {
  const date = day.startOf('day').toJSDate();
  const users = await prisma.supportUser.findMany({ where: { primeSlot: { not: null } } });
  const result: Truant[] = [];

  for (const user of users) {
    if (!user.primeSlot) continue;
    if (user.isOnVacation) continue;

    const entry = await prisma.voiceLog.findUnique({
      where: { userId_date_hourSlot: { userId: user.id, date, hourSlot: user.primeSlot } },
    });

    if (entry?.isCompleted) continue;
    // Слот закрыт заменой — прогул не засчитываем.
    if (entry?.substitutedBy) continue;

    result.push({
      userId: user.id,
      slot: user.primeSlot,
      minutes: entry?.minutesSpent ?? 0,
      misses: user.weeklyMisses,
    });
  }

  return result.sort((a, b) => a.slot.localeCompare(b.slot, 'ru', { numeric: true }));
}

/** Эмбед «📋 Список прогульщиков». */
export function renderTruantsEmbed(truants: Truant[]): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle('\u{1F4CB} Список прогульщиков').setColor(0xef4444);

  if (!truants.length) {
    embed.setDescription('Прогулов нет — все слоты закрыты. \u{1F389}');
    return embed;
  }

  const lines = truants.map(
    (t) => `• <@${t.userId}> ${t.slot} - ${t.minutes} минут - Пропущено ПТ [${t.misses}]`,
  );

  embed.setDescription(chunk(lines));
  return embed;
}

function chunk(lines: string[]): string {
  let out = '';
  for (const line of lines) {
    if (out.length + line.length + 1 > 4000) {
      out += '\n…список обрезан';
      break;
    }
    out += `${line}\n`;
  }
  return out.trim();
}

function truncate(value: string): string {
  return value.length > 1024 ? `${value.slice(0, 1020)}…` : value;
}

export async function fetchDisplayName(client: Client, userId: string): Promise<string> {
  const user = await client.users.fetch(userId).catch(() => null);
  return user?.username ?? userId;
}

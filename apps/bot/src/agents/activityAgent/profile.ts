/**
 * ──────────────────────────────────────────────────────────────
 *  АГЕНТ 4 — discord_activity_agent
 *  Сборка профиля саппорта: единый источник данных и для эмбеда
 *  `/support profile`, и для REST-ответа Mini App.
 * ──────────────────────────────────────────────────────────────
 */
import type { Client } from 'discord.js';
import { prisma, ensureSupport } from '../../db.js';
import { config } from '../../config.js';
import { daysSince, fmtDateShort } from '../../lib/time.js';
import { salaryForecast, currency } from '../../lib/economy.js';

export interface ProfilePayload {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  stats: {
    daysOnSupport: number;
    approved: number;
    rejected: number;
    totalVoiceMinutes: number;
    acceptedSwaps: number;
    ticketsProcessed: number;
  };
  widget: {
    tokens: number;
    salaryForecast: string;
    currency: string;
    vacation: string;
    warnings: number;
  };
  meta: {
    joinDate: string;
    primeSlot: string | null;
    isProbation: boolean;
    probationEnd: string | null;
    weeklyMisses: number;
    passMinutes: number;
  };
}

export async function buildProfile(client: Client, userId: string): Promise<ProfilePayload> {
  const discordUser = await client.users.fetch(userId).catch(() => null);
  const user = await ensureSupport(userId, discordUser?.username ?? userId);

  const [approved, rejected] = await Promise.all([
    prisma.voiceLog.count({ where: { userId, isCompleted: true } }),
    prisma.voiceLog.count({ where: { userId, isCompleted: false, isVacation: false } }),
  ]);

  return {
    id: user.id,
    username: user.username,
    avatarUrl: discordUser?.displayAvatarURL({ size: 256 }) ?? null,
    role: 'Саппорт',
    stats: {
      daysOnSupport: daysSince(user.joinDate),
      approved,
      rejected,
      totalVoiceMinutes: user.totalVoiceMinutes,
      acceptedSwaps: user.acceptedSwaps,
      ticketsProcessed: user.ticketsProcessed,
    },
    widget: {
      tokens: user.tokens,
      salaryForecast: salaryForecast(user.tokens),
      currency,
      vacation:
        user.isOnVacation && user.vacationUntil ? `До ${fmtDateShort(user.vacationUntil)}` : 'Нет',
      warnings: user.warnings,
    },
    meta: {
      joinDate: user.joinDate.toISOString(),
      primeSlot: user.primeSlot,
      isProbation: user.isProbation,
      probationEnd: user.probationEnd?.toISOString() ?? null,
      weeklyMisses: user.weeklyMisses,
      passMinutes: config.PRIME_PASS_MINUTES,
    },
  };
}

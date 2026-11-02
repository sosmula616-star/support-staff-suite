import type { VoiceLog } from '@prisma/client';

export const FLAG = {
  vacation: '\u{1F334}', // 🌴
  shield: '\u{1F6E1}️', // 🛡️
  extra: '⚡', // ⚡
} as const;

/** Суффикс флагов для строки отчёта: 🌴 / 🛡️ / ⚡ / (замена). */
export function flagSuffix(log: Pick<VoiceLog, 'isVacation' | 'isShield' | 'isExtra' | 'substitutedBy'>): string {
  const parts: string[] = [];
  if (log.isVacation) parts.push(FLAG.vacation);
  if (log.isShield) parts.push(FLAG.shield);
  if (log.isExtra) parts.push(FLAG.extra);
  if (log.substitutedBy) parts.push(`(замена <@${log.substitutedBy}>)`);
  return parts.length ? ` ${parts.join(' ')}` : '';
}

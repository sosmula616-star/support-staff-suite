import { DateTime } from 'luxon';

/** Все 24 часовых слота суток: "0:00-1:00" ... "23:00-0:00". */
export const ALL_SLOTS: string[] = Array.from({ length: 24 }, (_, h) => slotForHour(h));

export function slotForHour(hour: number): string {
  const end = (hour + 1) % 24;
  return `${hour}:00-${end}:00`;
}

/** Нормализует пользовательский ввод ПТ: "20", "20:00", "20:00-21:00" -> "20:00-21:00". */
export function normalizeSlot(input: string): string | null {
  const raw = input.trim().replace(/\s/g, '');
  const range = raw.match(/^(\d{1,2})(?::00)?-(\d{1,2})(?::00)?$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start > 23 || end > 23) return null;
    if ((start + 1) % 24 !== end) return null;
    return slotForHour(start);
  }
  const single = raw.match(/^(\d{1,2})(?::00)?$/);
  if (single) {
    const start = Number(single[1]);
    if (start > 23) return null;
    return slotForHour(start);
  }
  return null;
}

export function slotStartHour(slot: string): number {
  return Number(slot.split(':')[0]);
}

/** Границы слота для конкретных суток. */
export function slotBounds(slot: string, day: DateTime): { start: DateTime; end: DateTime } {
  const hour = slotStartHour(slot);
  const start = day.startOf('day').plus({ hours: hour });
  return { start, end: start.plus({ hours: 1 }) };
}

/** В какой слот попадает момент времени. */
export function slotOf(dt: DateTime): string {
  return slotForHour(dt.hour);
}

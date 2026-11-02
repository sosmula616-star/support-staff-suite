import { DateTime } from 'luxon';
import { config } from '../config.js';

export const now = () => DateTime.now().setZone(config.TIMEZONE);

/** Начало суток в рабочем часовом поясе, как JS Date (UTC-инстант). */
export const startOfDay = (dt = now()) => dt.startOf('day').toJSDate();

/** Предыдущие сутки — именно за них строится отчёт в 0:00. */
export const previousDay = () => now().minus({ days: 1 }).startOf('day');

export const fmtDate = (d: Date | DateTime) =>
  (d instanceof Date ? DateTime.fromJSDate(d) : d).setZone(config.TIMEZONE).toFormat('dd.MM.yyyy');

export const fmtDateShort = (d: Date | DateTime) =>
  (d instanceof Date ? DateTime.fromJSDate(d) : d).setZone(config.TIMEZONE).toFormat('dd.MM.yy');

export const daysSince = (d: Date) => Math.max(0, Math.floor(now().diff(DateTime.fromJSDate(d), 'days').days));

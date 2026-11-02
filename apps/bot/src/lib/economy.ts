import { config } from '../config.js';

/** Прогноз зарплаты по балансу токенов. */
export function salaryForecast(tokens: number): string {
  const value = tokens * config.SALARY_RATE;
  const rounded = Math.round(value * 100) / 100;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}`;
}

export const currency = config.SALARY_CURRENCY;

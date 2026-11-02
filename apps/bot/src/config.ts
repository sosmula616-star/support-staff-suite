import 'dotenv/config';
import { z } from 'zod';

const snowflake = z.string().regex(/^\d{5,25}$/, 'ожидается Discord ID (только цифры)');
const optionalSnowflake = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const schema = z.object({
  DISCORD_TOKEN: z.string().min(10, 'DISCORD_TOKEN не заполнен'),
  DISCORD_CLIENT_ID: snowflake,
  DISCORD_CLIENT_SECRET: z.string().optional().default(''),
  DISCORD_PUBLIC_KEY: z.string().optional().default(''),

  GUILD_ID: snowflake,
  SUPPORT_ROLE_ID: optionalSnowflake,
  ADMIN_ROLE_ID: optionalSnowflake,

  LOUNGE_VOICE_CHANNEL_ID: snowflake,
  LOGS_CHANNEL_ID: optionalSnowflake,

  THREAD_NEWS: optionalSnowflake,
  THREAD_WARNINGS: optionalSnowflake,
  THREAD_REMOVALS: optionalSnowflake,
  THREAD_REPORTS: optionalSnowflake,
  THREAD_SHOP: optionalSnowflake,
  THREAD_MEETINGS: optionalSnowflake,
  THREAD_TOKENS: optionalSnowflake,
  THREAD_PRIMES: optionalSnowflake,
  THREAD_SWAPS: optionalSnowflake,

  DATABASE_URL: z.string().min(1, 'DATABASE_URL не заполнен'),

  PRIME_PASS_MINUTES: z.coerce.number().int().positive().default(47),
  PRIME_SLOT_MINUTES: z.coerce.number().int().positive().default(60),
  TIMEZONE: z.string().default('Europe/Moscow'),
  WEEKLY_RESET_DAY: z.coerce.number().int().min(1).max(7).default(1),

  TOKENS_PER_PRIME: z.coerce.number().int().default(10),
  SALARY_RATE: z.coerce.number().default(0.0365),
  SALARY_CURRENCY: z.string().default('₽'),

  PORT: z.coerce.number().int().default(3000),
  PUBLIC_BASE_URL: z.string().default('http://localhost:3000'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n[config] Некорректный .env:\n');
  for (const issue of parsed.error.issues) {
    console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nСверься с .env.example\n');
  process.exit(1);
}

export const config = parsed.data;

export const LOG_THREADS = {
  news: config.THREAD_NEWS,
  warnings: config.THREAD_WARNINGS,
  removals: config.THREAD_REMOVALS,
  reports: config.THREAD_REPORTS,
  shop: config.THREAD_SHOP,
  meetings: config.THREAD_MEETINGS,
  tokens: config.THREAD_TOKENS,
  primes: config.THREAD_PRIMES,
  swaps: config.THREAD_SWAPS,
} as const;

export type LogThread = keyof typeof LOG_THREADS;

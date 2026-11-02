/**
 * Точка входа. Поднимает Discord-клиент, регистрирует всех четырёх агентов
 * и REST-бэкенд для Mini App.
 */
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { prisma } from './db.js';
import { registerVoiceTracker } from './agents/voiceTracker/index.js';
import { registerCronReporter } from './agents/cronReporter/index.js';
import { registerInteractionRouter } from './interactions/router.js';
import { startApiServer } from './api/server.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// Агент 1 — голосовой трекер
registerVoiceTracker(client);
// Агент 2 — крон и отчёты
registerCronReporter(client);
// Агент 3 + 4 — команды, панель, модалки, Mini App
registerInteractionRouter(client);

client.once(Events.ClientReady, (ready) => {
  logger.info(`вошёл как ${ready.user.tag}`);
  logger.info(`сервер: ${config.GUILD_ID}, лаундж: ${config.LOUNGE_VOICE_CHANNEL_ID}`);
  startApiServer(client);
});

client.on(Events.Error, (err) => logger.error('ошибка клиента:', err));
process.on('unhandledRejection', (err) => logger.error('unhandledRejection:', err));

async function shutdown(signal: string) {
  logger.info(`получен ${signal} — выключаюсь`);
  await prisma.$disconnect().catch(() => undefined);
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

client.login(config.DISCORD_TOKEN).catch((err) => {
  logger.error('не удалось войти — проверь DISCORD_TOKEN:', err);
  process.exit(1);
});

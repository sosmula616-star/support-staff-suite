/**
 * Регистрация слэш-команд на сервере GUILD_ID.
 * Запуск: npm run deploy:commands
 */
import { REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { commands } from '../commands/index.js';
import { createLogger } from '../logger.js';

const log = createLogger('deploy-commands');

async function main() {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const body = commands.map((cmd) => cmd.data.toJSON());

  log.info(`регистрирую ${body.length} команд на сервере ${config.GUILD_ID}…`);

  await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.GUILD_ID), {
    body,
  });

  log.info('готово:', commands.map((c) => `/${c.data.name}`).join(', '));
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});

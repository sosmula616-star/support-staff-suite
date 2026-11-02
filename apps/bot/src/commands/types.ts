import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

export interface BotCommand {
  /** JSON-тело для регистрации слэш-команды. */
  data: { toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody; name: string };
  /** Доступна только вышке. */
  adminOnly?: boolean;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

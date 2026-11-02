import {
  type Client,
  type MessageCreateOptions,
  type TextBasedChannel,
  ChannelType,
} from 'discord.js';
import { LOG_THREADS, config, type LogThread } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('logRouter');

/**
 * Строгая маршрутизация событий по веткам канала #логи.
 * Если ветка не настроена в .env — падаем обратно на сам канал #логи.
 */
export async function routeLog(
  client: Client,
  thread: LogThread,
  payload: string | MessageCreateOptions,
) {
  const target = LOG_THREADS[thread] ?? config.LOGS_CHANNEL_ID;
  if (!target) {
    log.warn(`ветка "${thread}" и LOGS_CHANNEL_ID не настроены — сообщение не отправлено`);
    return null;
  }

  try {
    const channel = await client.channels.fetch(target);
    if (!channel || !isSendable(channel)) {
      log.warn(`канал ${target} ("${thread}") не найден или в него нельзя писать`);
      return null;
    }
    if (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread) {
      if (channel.archived) await channel.setArchived(false).catch(() => undefined);
    }
    return await channel.send(payload as MessageCreateOptions);
  } catch (err) {
    log.error(`не удалось отправить лог в "${thread}":`, err);
    return null;
  }
}

function isSendable(channel: unknown): channel is TextBasedChannel & { send: Function; type: ChannelType; archived?: boolean; setArchived?: Function } {
  return typeof (channel as { send?: unknown }).send === 'function';
}

/**
 * Инициализация Discord Embedded App SDK + авторизация.
 * Вне Discord (обычный браузер) работает демо-режим без авторизации.
 */
import { DiscordSDK } from '@discord/embedded-app-sdk';

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

/** Внутри Activity Discord всегда добавляет frame_id в query. */
export const isInsideDiscord = () =>
  new URLSearchParams(window.location.search).has('frame_id');

/** Внутри Activity все внешние запросы идут через /.proxy/. */
export const apiBase = () => (isInsideDiscord() ? '/.proxy/api' : '/api');

let accessToken: string | null = null;

export const getAccessToken = () => accessToken;

export async function setupDiscord(): Promise<{ authed: boolean; error?: string }> {
  if (!isInsideDiscord()) {
    return { authed: false, error: 'demo' };
  }

  if (!CLIENT_ID) {
    return { authed: false, error: 'VITE_DISCORD_CLIENT_ID не задан' };
  }

  try {
    const sdk = new DiscordSDK(CLIENT_ID);
    await sdk.ready();

    const { code } = await sdk.commands.authorize({
      client_id: CLIENT_ID,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify', 'guilds'],
    });

    const response = await fetch(`${apiBase()}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = (await response.json()) as { access_token?: string; error?: string };
    if (!data.access_token) {
      return { authed: false, error: data.error ?? 'не удалось получить токен' };
    }

    await sdk.commands.authenticate({ access_token: data.access_token });
    accessToken = data.access_token;

    return { authed: true };
  } catch (err) {
    return { authed: false, error: err instanceof Error ? err.message : String(err) };
  }
}

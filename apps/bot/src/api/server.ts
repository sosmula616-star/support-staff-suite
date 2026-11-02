/**
 * ──────────────────────────────────────────────────────────────
 *  REST-бэкенд для Discord Activity (Mini App).
 *  Отдаёт собранный фронт из apps/activity/dist и API:
 *    POST /api/token          — обмен OAuth-кода на access_token
 *    GET  /api/profile        — профиль авторизованного саппорта
 *    GET  /api/primes         — таблица ПТ
 *    POST /api/actions/:name  — кнопки нижней сетки
 * ──────────────────────────────────────────────────────────────
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from 'discord.js';
import { prisma, ensureSupport } from '../db.js';
import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { buildProfile } from '../agents/activityAgent/profile.js';
import { routeLog } from '../lib/logRouter.js';
import { ALL_SLOTS, normalizeSlot } from '../lib/slots.js';
import { now } from '../lib/time.js';

const log = createLogger('activity_api');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.resolve(__dirname, '../../../activity/dist');

interface AuthedRequest extends Request {
  discordUserId?: string;
  discordUsername?: string;
}

export function startApiServer(client: Client) {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, bot: client.user?.tag ?? null, ts: Date.now() });
  });

  /** Обмен кода авторизации Activity на access_token. */
  app.post('/api/token', async (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '');
    if (!code) {
      res.status(400).json({ error: 'code обязателен' });
      return;
    }
    if (!config.DISCORD_CLIENT_SECRET) {
      res.status(500).json({ error: 'DISCORD_CLIENT_SECRET не заполнен в .env' });
      return;
    }

    try {
      const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.DISCORD_CLIENT_ID,
          client_secret: config.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
        }),
      });

      const data = (await response.json()) as { access_token?: string; error?: string };
      if (!response.ok || !data.access_token) {
        log.warn('обмен кода не удался:', data);
        res.status(401).json({ error: data.error ?? 'не удалось обменять код' });
        return;
      }

      res.json({ access_token: data.access_token });
    } catch (err) {
      log.error('ошибка обмена кода:', err);
      res.status(500).json({ error: 'internal' });
    }
  });

  /** Проверка Bearer-токена через Discord API. */
  const auth = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!token) {
      res.status(401).json({ error: 'нет авторизации' });
      return;
    }

    try {
      const response = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        res.status(401).json({ error: 'токен недействителен' });
        return;
      }
      const user = (await response.json()) as { id: string; username: string };
      req.discordUserId = user.id;
      req.discordUsername = user.username;
      next();
    } catch (err) {
      log.error('ошибка проверки токена:', err);
      res.status(401).json({ error: 'токен недействителен' });
    }
  };

  app.get('/api/profile', auth, async (req: AuthedRequest, res: Response) => {
    const profile = await buildProfile(client, req.discordUserId!);
    res.json(profile);
  });

  app.get('/api/primes', auth, async (_req: AuthedRequest, res: Response) => {
    const users = await prisma.supportUser.findMany({
      where: { primeSlot: { not: null } },
      select: { id: true, username: true, primeSlot: true, isOnVacation: true },
    });

    const table = ALL_SLOTS.map((slot) => ({
      slot,
      holders: users.filter((u) => u.primeSlot === slot),
    }));

    res.json({ table });
  });

  /** Кнопки нижней сетки Mini App. */
  app.post('/api/actions/:name', auth, async (req: AuthedRequest, res: Response) => {
    const userId = req.discordUserId!;
    const username = req.discordUsername ?? userId;
    const action = req.params.name;
    await ensureSupport(userId, username);

    switch (action) {
      case 'swap': {
        const slot = normalizeSlot(String(req.body?.slot ?? ''));
        if (!slot) {
          res.status(400).json({ error: 'некорректный слот' });
          return;
        }
        await prisma.swapRequest.create({
          data: { requesterId: userId, slot, date: now().startOf('day').toJSDate() },
        });
        await routeLog(
          client,
          'swaps',
          `\u{1F64B} <@${userId}> ищет замену на ПТ **${slot}** (заявка из Mini App).`,
        );
        res.json({ ok: true, message: `Заявка на замену ${slot} отправлена в #логи > Замены.` });
        return;
      }

      case 'extra': {
        const slot = normalizeSlot(String(req.body?.slot ?? ''));
        if (!slot) {
          res.status(400).json({ error: 'некорректный слот' });
          return;
        }
        await routeLog(
          client,
          'primes',
          `⚡ <@${userId}> взял доп. ПТ на **${slot}** (заявка из Mini App).`,
        );
        res.json({ ok: true, message: `Доп. ПТ ${slot} зарегистрирован.` });
        return;
      }

      case 'vacation': {
        const until = String(req.body?.until ?? '');
        await routeLog(
          client,
          'news',
          `\u{1F334} <@${userId}> запросил отпуск${until ? ` до **${until}**` : ''} (заявка из Mini App).`,
        );
        res.json({ ok: true, message: 'Заявка на отпуск отправлена вышке.' });
        return;
      }

      case 'promo': {
        const code = String(req.body?.code ?? '').trim();
        if (!code) {
          res.status(400).json({ error: 'промокод пуст' });
          return;
        }
        await routeLog(client, 'shop', `\u{1F3AB} <@${userId}> активировал промокод \`${code}\`.`);
        res.json({ ok: true, message: 'Промокод отправлен на проверку.' });
        return;
      }

      default:
        res.status(404).json({ error: `действие "${action}" пока не реализовано` });
    }
  });

  // Статика Mini App
  app.use(express.static(STATIC_DIR));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'), (err) => {
      if (err) res.status(404).send('Mini App не собран. Запусти: npm run build');
    });
  });

  app.listen(config.PORT, () => {
    log.info(`API + Mini App на http://localhost:${config.PORT} (публично: ${config.PUBLIC_BASE_URL})`);
  });

  return app;
}

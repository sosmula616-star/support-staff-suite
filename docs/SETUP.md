# Настройка: что куда вписать

Всё, что нужно заполнить, лежит в одном файле — `.env` (скопируй из `.env.example`). Ниже — откуда брать каждое значение.

Сначала включи **Настройки Discord → Расширенные → Режим разработчика**, иначе не будет пункта «Копировать ID».

---

## 1. Discord Application

Открой <https://discord.com/developers/applications> → **New Application** (или выбери существующее).

| Переменная | Где взять |
| --- | --- |
| `DISCORD_CLIENT_ID` | вкладка **General Information** → поле **Application ID** |
| `DISCORD_PUBLIC_KEY` | там же → **Public Key** |
| `DISCORD_CLIENT_SECRET` | вкладка **OAuth2** → **Client Secret** → `Reset Secret` |
| `DISCORD_TOKEN` | вкладка **Bot** → `Reset Token` → скопировать (показывается один раз) |

На вкладке **Bot** включи три Privileged Gateway Intents:

- **Server Members Intent**
- **Presence Intent** — не обязателен, но не мешает
- **Message Content Intent** — не обязателен

Голосовой трекинг работает на интенте `GuildVoiceStates`, он не привилегированный и включать его в панели не нужно.

### Приглашение бота на сервер

**OAuth2 → URL Generator**: scopes `bot` + `applications.commands`, права — `Administrator` (проще всего) либо минимум: Read Messages, Send Messages, Send Messages in Threads, Embed Links, Use Slash Commands, View Channels, Connect.

---

## 2. Сервер и роли

| Переменная | Где взять |
| --- | --- |
| `GUILD_ID` | ПКМ по иконке сервера → **Копировать ID сервера** |
| `SUPPORT_ROLE_ID` | Настройки сервера → Роли → ПКМ по роли «Саппорт» → **Копировать ID** |
| `ADMIN_ROLE_ID` | то же для роли вышки |

`ADMIN_ROLE_ID` можно оставить пустым — тогда админ-команды доступны всем с правом «Управление сервером».

---

## 3. Голосовой канал

| Переменная | Где взять |
| --- | --- |
| `LOUNGE_VOICE_CHANNEL_ID` | ПКМ по голосовому каналу «Лаундж» → **Копировать ID канала** |

---

## 4. Канал `#логи` и девять веток

ПКМ по каналу `#логи` → **Копировать ID канала** → это `LOGS_CHANNEL_ID`.

Дальше по каждой ветке: ПКМ по ветке в списке → **Копировать ID ветки**.

| Переменная | Ветка |
| --- | --- |
| `THREAD_NEWS` | Новости |
| `THREAD_WARNINGS` | Выговоры |
| `THREAD_REMOVALS` | Снятия |
| `THREAD_REPORTS` | **Отчёты** — сюда падают суточный отчёт, список прогульщиков и объяснительные |
| `THREAD_SHOP` | Магазин |
| `THREAD_MEETINGS` | Собрания |
| `THREAD_TOKENS` | Токены |
| `THREAD_PRIMES` | Прайм-таймы |
| `THREAD_SWAPS` | Замены |

Незаполненная ветка — не ошибка: такие логи уйдут в сам канал `#логи`. Но `THREAD_REPORTS` лучше заполнить обязательно.

Важно: ветки не должны быть заархивированы навсегда. Бот сам разархивирует ветку перед отправкой, но у него должно быть право **Send Messages in Threads**.

---

## 5. База данных

| Переменная | Значение |
| --- | --- |
| `DATABASE_URL` | строка подключения PostgreSQL |

Локально проще всего через Docker — в репозитории уже лежит `docker-compose.yml`:

```bash
docker compose up -d
```

Тогда строка такая (уже стоит в `.env.example`):

```
postgresql://support:support@localhost:5432/support?schema=public
```

Облачные варианты: [Neon](https://neon.tech), [Supabase](https://supabase.com), Railway — там строка выдаётся готовой, её и вставь.

После заполнения создай таблицы:

```bash
npm run db:push
```

### Если база уже используется другим ботом

`npm run db:push` управляет всей схемой целиком и предложит снести чужие таблицы. **Не соглашайся на `--accept-data-loss`** — вместо этого положи таблицы в отдельную схему Postgres, добавив к строке подключения `?schema=support`:

```
postgresql://user:pass@host:5432/dbname?schema=support
```

Тогда `db:push` создаст отдельное пространство имён и не тронет то, что лежит в `public`. Проверить, что получилось:

```sql
select table_schema, table_name from information_schema.tables
where table_schema in ('public', 'support');
```

---

## 6. Правила подсчёта

Эти значения уже проставлены по ТЗ, трогать не обязательно.

| Переменная | По умолчанию | Смысл |
| --- | --- | --- |
| `PRIME_PASS_MINUTES` | `47` | минимум минут для галочки `✓` |
| `PRIME_SLOT_MINUTES` | `60` | длина слота, показывается в ЛС как «из требуемых 60» |
| `TIMEZONE` | `Europe/Moscow` | часовой пояс, по которому срабатывает крон в 0:00 |
| `WEEKLY_RESET_DAY` | `1` | день сброса прогулов, 1 = понедельник |
| `TOKENS_PER_PRIME` | `10` | начисление за успешный ПТ |
| `SALARY_RATE` | `0.0365` | прогноз зарплаты = `tokens × SALARY_RATE` |
| `SALARY_CURRENCY` | `₽` | валюта в виджете |

---

## 7. Mini App (Discord Activity)

Mini App — это веб-страница, которую Discord открывает внутри себя. Ей нужен публичный `https`-адрес.

| Переменная | Значение |
| --- | --- |
| `PORT` | порт локального сервера, по умолчанию `3000` |
| `PUBLIC_BASE_URL` | публичный `https`-адрес, на который смотрит Discord |
| `VITE_DISCORD_CLIENT_ID` | тот же, что `DISCORD_CLIENT_ID` |

`VITE_DISCORD_CLIENT_ID` нужно продублировать в `apps/activity/.env` — Vite читает только переменные с префиксом `VITE_`:

```bash
cp apps/activity/.env.example apps/activity/.env
```

### Туннель для разработки

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Полученный адрес вида `https://что-то.trycloudflare.com` вставь в `PUBLIC_BASE_URL`.

### Включение Activity в панели разработчика

1. В приложении открой вкладку **Activities → Settings** и включи активности.
2. **URL Mappings** → добавь маппинг: Prefix `/`, Target — твой домен без `https://` (например `что-то.trycloudflare.com`).
3. В **Activity Shelf** заполни название и описание, иначе Discord не даст запустить.

Без настроенной Activity бот всё равно работает: `/support profile` покажет эмбед-профиль, кнопка просто откроет страницу в браузере.

---

## 8. Проверка, что всё взлетело

```bash
npm install
npm run db:push
npm run deploy:commands
npm run dev:bot
```

В консоли должно появиться:

```
INFO  (core) вошёл как ИмяБота#0000
INFO  (voice_tracker_agent) трекинг канала 123..., порог 47 мин.
INFO  (cron_reporter_agent) крон запущен (TZ=Europe/Moscow), отчёт в 0:00 ...
INFO  (activity_api) API + Mini App на http://localhost:3000 ...
```

Проверь по шагам:

- `/prime set @кто-то 20:00-21:00` → в ветке `Прайм-таймы` появилась запись
- зайди в «Лаундж», подожди пару минут, выйди → `/report run` покажет минуты
- `/report run` → в ветке `Отчёты` два эмбеда: сетка 24 слотов и список прогульщиков
- прогульщику пришло ЛС с кнопкой «Объясниться» → нажми, заполни → текст прилетел в `Отчёты`
- `/admin panel @кто-то` → кнопки переключают цвет и состояние

Если бот не стартует — он сам напишет, какая переменная в `.env` не заполнена или заполнена неверно.

---

## 9. Прод

Любой VPS с Node 20+ и PostgreSQL:

```bash
npm ci
npm run build
npm run deploy:commands
npm start
```

Держать процесс живым — через `pm2 start apps/bot/dist/index.js --name support-bot` или systemd-юнит. Для Mini App нужен настоящий домен с сертификатом (nginx + certbot как reverse proxy на `PORT`).

---

## Шпаргалка: минимум, чтобы бот заработал

Без этих девяти значений бот не стартует:

```
DISCORD_TOKEN
DISCORD_CLIENT_ID
GUILD_ID
LOUNGE_VOICE_CHANNEL_ID
DATABASE_URL
```

Плюс для нормальной работы отчётов:

```
LOGS_CHANNEL_ID
THREAD_REPORTS
ADMIN_ROLE_ID
SUPPORT_ROLE_ID
```

Остальное — опционально и имеет разумные значения по умолчанию.

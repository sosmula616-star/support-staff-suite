# Support Staff Suite

Discord-бот + Discord Activity (Mini App) для стаффа саппортов: трекинг прайм-таймов в голосовом канале, суточные отчёты в 0:00, админ-панель вышки и профиль саппорта в Mini App.

## Что умеет

**Трекинг ПТ.** Бот слушает голосовой канал «Лаундж» и копит минуты по часовым слотам. ПТ засчитан при `>= 47` минутах за слот, меньше — прогул. Флаги: `🌴` отпуск, `🛡️` первый ПТ в стаффе, `⚡` доп. смена, `(замена)` с ID замещающего.

**Отчёты в 0:00.** Эмбед «📊 Активность за прошедшие сутки» с сеткой всех 24 слотов (`[✓ - 48] @user` / `[✗ - 0] @user` / `Свободно`), следом «📋 Список прогульщиков» в формате `• @user ЧЧ:00-ЧЧ:00 - X минут - Пропущено ПТ [N]`. Обе публикации — в ветку `#логи > Отчёты`.

**Объяснительные.** Каждому прогульщику в 0:00 уходит ЛС с кнопкой «Объясниться» → модальное окно → текст падает в ту же ветку `Отчёты`. Счётчик прогулов `[N]` сбрасывается по понедельникам в 0:00.

**Админ-панель.** `/admin panel @саппорт` — ephemeral-карточка с ПТ, датой принятия и балансом. Кнопки: `Дата принятия` (модалка), `Исп. срок` (тоггл, по умолчанию 7 дней, зелёная/серая), `Отпуск` (серая → модалка с датой; зелёная → отмена), `Удалить из БД` (красная, с подтверждением).

**Mini App.** `/support profile` показывает эмбед-профиль и кнопку запуска Activity: тёмная неоново-фиолетовая тема, левый блок с аватаром/ником/ролью, центральная статистика, правый виджет (токены, прогноз зарплаты, отпуск, выговоры) и нижняя сетка из 8 кнопок действий. Блок питомцев исключён.

## Команды

| Команда | Кому | Что делает |
| --- | --- | --- |
| `/admin panel @саппорт` | вышка | интерактивная карточка управления |
| `/award @user [amount] [reason]` | вышка | выдать токены |
| `/take @user [amount] [reason]` | вышка | забрать токены |
| `/prime set @user [time]` | вышка | назначить/сменить ПТ (`20`, `20:00`, `20:00-21:00`) |
| `/prime remove @user` | вышка | снять ПТ |
| `/prime list` | вышка | таблица распределения ПТ |
| `/prime add @user [date] [slot]` | вышка | вручную засчитать ПТ (по умолчанию за сегодня) |
| `/miss @user [count]` | вышка | вычесть прогул из счётчика `[N]` |
| `/swap_as @user [substitute]` | вышка | оформить замену от имени саппорта |
| `/dm @user [message]` | вышка | ЛС от имени бота |
| `/report run [date]` | вышка | собрать суточный отчёт вручную |
| `/report reset_misses` | вышка | сбросить счётчик прогулов |
| `/support profile [user]` | все | профиль саппорта + запуск Mini App |

## Архитектура

Четыре изолированных агента, каждый со своей зоной ответственности:

| Агент | Модуль | Ответственность |
| --- | --- | --- |
| `voice_tracker_agent` | [apps/bot/src/agents/voiceTracker](apps/bot/src/agents/voiceTracker/index.ts) | голосовая активность, минуты по слотам, флаги |
| `cron_reporter_agent` | [apps/bot/src/agents/cronReporter](apps/bot/src/agents/cronReporter/index.ts) | крон 0:00, отчёт, прогульщики, рассылка ЛС, недельный сброс |
| `admin_control_agent` | [apps/bot/src/agents/adminControl](apps/bot/src/agents/adminControl/index.ts) | команды вышки, панель, роутинг логов по веткам |
| `discord_activity_agent` | [apps/bot/src/agents/activityAgent](apps/bot/src/agents/activityAgent/profile.ts) + [apps/activity](apps/activity) | `/support profile`, REST API, Mini App на Embedded App SDK |

```
apps/
  bot/                 Node 20 + discord.js v14 + Express + node-cron + Prisma
    src/agents/        четыре агента
    src/commands/      слэш-команды
    src/interactions/  кнопки и модалки
    src/api/           REST для Mini App + раздача статики
    src/lib/           слоты, флаги, время, роутер логов, права
  activity/            React 18 + Vite + @discord/embedded-app-sdk
prisma/schema.prisma   PostgreSQL
```

Логи строго маршрутизируются по веткам канала `#логи`: `Новости`, `Выговоры`, `Снятия`, `Отчёты`, `Магазин`, `Собрания`, `Токены`, `Прайм-таймы`, `Замены`. Если ID ветки не задан — сообщение уходит в сам канал `#логи`.

## Запуск

```bash
git clone https://github.com/sosmula616-star/support-staff-suite.git
cd support-staff-suite
cp .env.example .env    # заполнить (см. docs/SETUP.md)
npm install
docker compose up -d    # PostgreSQL, если нет своего
npm run db:push         # создать таблицы
npm run deploy:commands # зарегистрировать слэш-команды
npm run build
npm start
```

Разработка: `npm run dev:bot` и `npm run dev:activity` в двух терминалах.

**Все переменные окружения и где их взять — в [docs/SETUP.md](docs/SETUP.md).**

## Стек

Node.js 20+, TypeScript, discord.js v14, Prisma 6 + PostgreSQL, Express, node-cron, Luxon, React 18, Vite 6, @discord/embedded-app-sdk.

/**
 * ──────────────────────────────────────────────────────────────
 *  АГЕНТ 3 — admin_control_agent
 *  Действия вышки: слэш-команды, интерактивная панель,
 *  строгий роутинг логов по веткам #логи.
 * ──────────────────────────────────────────────────────────────
 */
export { buildPanel } from './panel.js';
export { commands, commandMap } from '../../commands/index.js';
export { routeLog } from '../../lib/logRouter.js';

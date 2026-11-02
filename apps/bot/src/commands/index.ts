import { adminCommand } from './admin.js';
import { awardCommand, takeCommand } from './economy.js';
import { primeCommand, missCommand } from './prime.js';
import { swapAsCommand, dmCommand, reportCommand } from './staff.js';
import { supportCommand } from './support.js';
import type { BotCommand } from './types.js';

export const commands: BotCommand[] = [
  adminCommand,
  awardCommand,
  takeCommand,
  primeCommand,
  missCommand,
  swapAsCommand,
  dmCommand,
  reportCommand,
  supportCommand,
];

export const commandMap = new Map(commands.map((cmd) => [cmd.data.name, cmd]));

export type { BotCommand };

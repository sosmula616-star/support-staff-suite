/** Единая точка входа для всех interaction-событий. */
import { type Client, Events, MessageFlags } from 'discord.js';
import { commandMap } from '../commands/index.js';
import { isAdmin } from '../lib/permissions.js';
import { createLogger } from '../logger.js';
import { openExplainModal, submitExplainModal } from './explain.js';
import {
  askDelete,
  cancelDelete,
  confirmDelete,
  openJoinDateModal,
  submitJoinDateModal,
  submitVacationModal,
  toggleProbation,
  toggleVacation,
} from './panel.js';
import {
  EXPLAIN_BUTTON_PREFIX,
  EXPLAIN_MODAL_PREFIX,
  PANEL_DELETE,
  PANEL_DELETE_CANCEL,
  PANEL_DELETE_CONFIRM,
  PANEL_JOINDATE,
  PANEL_JOINDATE_MODAL,
  PANEL_PROBATION,
  PANEL_VACATION,
  PANEL_VACATION_MODAL,
  parseId,
} from './ids.js';
import type { GuildMember } from 'discord.js';

const log = createLogger('interactions');

export function registerInteractionRouter(client: Client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commandMap.get(interaction.commandName);
        if (!command) return;

        if (command.adminOnly && !isAdmin(interaction.member as GuildMember | null)) {
          await interaction.reply({
            content: '⛔ Команда доступна только вышке.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await command.execute(interaction);
        return;
      }

      if (interaction.isButton()) {
        const { prefix } = parseId(interaction.customId);
        switch (prefix) {
          case EXPLAIN_BUTTON_PREFIX:
            return void (await openExplainModal(interaction));
          case PANEL_JOINDATE:
            return void (await openJoinDateModal(interaction));
          case PANEL_PROBATION:
            return void (await toggleProbation(interaction));
          case PANEL_VACATION:
            return void (await toggleVacation(interaction));
          case PANEL_DELETE:
            return void (await askDelete(interaction));
          case PANEL_DELETE_CONFIRM:
            return void (await confirmDelete(interaction));
          case PANEL_DELETE_CANCEL:
            return void (await cancelDelete(interaction));
          default:
            return;
        }
      }

      if (interaction.isModalSubmit()) {
        const { prefix } = parseId(interaction.customId);
        switch (prefix) {
          case EXPLAIN_MODAL_PREFIX:
            return void (await submitExplainModal(interaction));
          case PANEL_JOINDATE_MODAL:
            return void (await submitJoinDateModal(interaction));
          case PANEL_VACATION_MODAL:
            return void (await submitVacationModal(interaction));
          default:
            return;
        }
      }
    } catch (err) {
      log.error('ошибка обработки interaction:', err);
      if (interaction.isRepliable()) {
        const payload = {
          content: '❌ Что-то пошло не так. Загляни в логи бота.',
          flags: MessageFlags.Ephemeral as const,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => undefined);
        } else {
          await interaction.reply(payload).catch(() => undefined);
        }
      }
    }
  });
}

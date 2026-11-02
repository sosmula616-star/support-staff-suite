/** `/admin panel @саппорт` — интерактивная карточка управления (ephemeral). */
import { SlashCommandBuilder } from 'discord.js';
import { ensureSupport } from '../db.js';
import { buildPanel } from '../agents/adminControl/panel.js';
import type { BotCommand } from './types.js';

export const adminCommand: BotCommand = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Управление саппортами')
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription('Управление выбранным саппортом')
        .addUserOption((opt) =>
          opt.setName('саппорт').setDescription('Кого настраиваем').setRequired(true),
        ),
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('саппорт', true);
    const user = await ensureSupport(target.id, target.username);
    const panel = await buildPanel(interaction.client, user);
    await interaction.reply(panel);
  },
};

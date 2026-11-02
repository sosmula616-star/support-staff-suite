/**
 * `/support profile` — профиль саппорта.
 * Отвечает эмбедом (работает всегда) + кнопкой запуска Mini App.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { config } from '../config.js';
import { buildProfile } from '../agents/activityAgent/profile.js';
import { isSupport } from '../lib/permissions.js';
import type { GuildMember } from 'discord.js';
import type { BotCommand } from './types.js';

const ACTION_BUTTONS = [
  'Взять замену',
  'Взять доп. ПТ',
  'Прайм-таймы',
  'Задания',
  'Промокод',
  'Магазин',
  'Инвентарь',
  'Отпуск',
];

export const supportCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setDescription('Команды саппорта')
    .addSubcommand((sub) =>
      sub
        .setName('profile')
        .setDescription('Профиль саппорта')
        .addUserOption((o) =>
          o.setName('user').setDescription('Чей профиль (по умолчанию свой)').setRequired(false),
        ),
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') ?? interaction.user;

    if (target.id !== interaction.user.id && !isSupport(interaction.member as GuildMember | null)) {
      await interaction.reply({ content: '⛔ Чужие профили смотрит только стафф.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const profile = await buildProfile(interaction.client, target.id);

    const embed = new EmbedBuilder()
      .setTitle(`Профиль саппорта — ${profile.username}`)
      .setColor(0x8b5cf6)
      .addFields(
        {
          name: '\u{1F3A7} Статистика саппорта',
          value: [
            `Всего на саппорте: **${profile.stats.daysOnSupport}** дней`,
            `Допусков: **${profile.stats.approved}**`,
            `Недопусков: **${profile.stats.rejected}**`,
            `Всего минут в голосовых: **${profile.stats.totalVoiceMinutes.toLocaleString('ru-RU')}**`,
            `Принятых замен: **${profile.stats.acceptedSwaps}**`,
            `Обработано тикетов: **${profile.stats.ticketsProcessed}**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '\u{1FA99} Сводка',
          value: [
            `Токены: **${profile.widget.tokens}**`,
            `Прогноз зарплаты: **${profile.widget.salaryForecast} ${profile.widget.currency}**`,
            `Отпуск: **${profile.widget.vacation}**`,
            `Выговоры: **${profile.widget.warnings}**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '\u{1F5D3}️ Прайм-тайм',
          value: profile.meta.primeSlot ?? 'не назначен',
          inline: false,
        },
      )
      .setFooter({ text: `Доступные действия: ${ACTION_BUTTONS.join(' · ')}` })
      .setTimestamp(new Date());

    if (profile.avatarUrl) embed.setThumbnail(profile.avatarUrl);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Открыть Mini App')
        .setStyle(ButtonStyle.Link)
        .setURL(`${config.PUBLIC_BASE_URL}/?user=${profile.id}`),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};

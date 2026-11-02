import { type ChatInputCommandInteraction, type GuildMember, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';

/** «Вышка»: роль из ADMIN_ROLE_ID либо право «Управление сервером». */
export function isAdmin(member: GuildMember | null): boolean {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (config.ADMIN_ROLE_ID && member.roles.cache.has(config.ADMIN_ROLE_ID)) return true;
  return false;
}

export function isSupport(member: GuildMember | null): boolean {
  if (!member) return false;
  if (!config.SUPPORT_ROLE_ID) return true;
  return member.roles.cache.has(config.SUPPORT_ROLE_ID) || isAdmin(member);
}

export async function requireAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (isAdmin(interaction.member as GuildMember | null)) return true;
  await interaction.reply({
    content: '⛔ Команда доступна только вышке.',
    ephemeral: true,
  });
  return false;
}

/**
 * Permission mapping — Discord member permissions -> dispatcher ranks.
 *   rank 2 (admin): guild owner, Administrator, or ManageGuild
 *   rank 1 (mod):   BanMembers, KickMembers, ModerateMembers, or ManageMessages
 *   rank 0:         everyone else
 * The bot owner (owner Discord id) bypasses ranks entirely in the
 * dispatcher and is not handled here.
 */
import { PermissionFlagsBits } from "discord.js";
import type { PermissionRank } from "./dispatcher";

const MOD_FLAGS =
  PermissionFlagsBits.BanMembers |
  PermissionFlagsBits.KickMembers |
  PermissionFlagsBits.ModerateMembers |
  PermissionFlagsBits.ManageMessages;

const ADMIN_FLAGS = PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild;

export function rankFromMember(input: {
  isGuildOwner: boolean;
  permissions: bigint;
}): PermissionRank {
  if (input.isGuildOwner) return 2;
  if ((input.permissions & ADMIN_FLAGS) !== 0n) return 2;
  if ((input.permissions & MOD_FLAGS) !== 0n) return 1;
  return 0;
}

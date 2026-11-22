import { discordClientId } from "./discord";

/**
 * Link mời bot về server (OAuth2 authorize, scope bot + applications.commands).
 * Chưa cấu hình DISCORD_CLIENT_ID (app Discord riêng của bot) thì trả null —
 * nút mời ẩn hẳn, không hiện link chết.
 * Quyền xin: xem kênh, gửi tin, embed, đính kèm, đọc lịch sử, reaction,
 * emoji ngoài, gửi tin trong thread — đủ cho TCG/economy/minigame/kênh game.
 */
const INVITE_PERMISSIONS = "274878286912";

export function botInviteUrl(): string | null {
  const clientId = discordClientId();
  if (!clientId) return null;
  return (
    "https://discord.com/oauth2/authorize?client_id=" +
    clientId +
    "&permissions=" +
    INVITE_PERMISSIONS +
    "&scope=bot%20applications.commands"
  );
}

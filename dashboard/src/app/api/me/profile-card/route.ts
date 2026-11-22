import { currentSession } from "@/lib/current-session";
import { profileCardData, renderProfileCard } from "@/lib/profile-card";

/**
 * The player's profile card as a PNG (spec 6.39), rendered after
 * the owner's sample layout. Personal to the signed-in user.
 */
export async function GET() {
  const session = await currentSession();
  if (!session) return new Response("Chưa đăng nhập.", { status: 401 });
  const data = await profileCardData(session.userId, session.username, session.avatar);
  const png = await renderProfileCard(data);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}

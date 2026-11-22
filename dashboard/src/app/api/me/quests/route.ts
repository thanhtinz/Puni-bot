import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { claimQuestWeb, questView } from "@/lib/quests";

/**
 * Daily-quest claims (spec 6.38). The action field must match a
 * known verb exactly — anything else is an error, never a default
 * branch (money-safety rule).
 */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const back = (params: Record<string, string>) => {
    const url = new URL("/me/quests", req.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return NextResponse.redirect(url);
  };

  if (action === "claim") {
    const questId = String(form.get("questId") ?? "");
    const out = await claimQuestWeb(session.userId, questId);
    if (!out.ok) return back({ err: out.error });
    const parts = [
      out.coins ? `+${out.coins.toLocaleString("en-US")} Coins` : "",
      out.shards ? `+${out.shards} Mảnh thẻ` : "",
      out.bonusCoins || out.bonusShards
        ? `Thưởng hoàn thành cả 5: +${out.bonusCoins.toLocaleString("en-US")} Coins + ${out.bonusShards} Mảnh thẻ`
        : "",
    ].filter(Boolean);
    return back({ msg: `Đã nhận thưởng nhiệm vụ: ${parts.join(" · ")}` });
  }
  if (action === "claimall") {
    const view = await questView(session.userId);
    const ready = view.rows.filter((r) => r.done && !r.claimed);
    if (!ready.length) return back({ err: "Chưa có nhiệm vụ nào xong để nhận thưởng." });
    let coins = 0;
    let shards = 0;
    let claimed = 0;
    for (const r of ready) {
      const out = await claimQuestWeb(session.userId, r.id);
      if (out.ok) {
        claimed++;
        coins += out.coins + out.bonusCoins;
        shards += out.shards + out.bonusShards;
      }
    }
    if (!claimed) return back({ err: "Chưa có nhiệm vụ nào xong để nhận thưởng." });
    return back({
      msg: `Đã nhận ${claimed} nhiệm vụ: +${coins.toLocaleString("en-US")} Coins · +${shards} Mảnh thẻ`,
    });
  }
  return back({ err: "Hành động không hợp lệ." });
}

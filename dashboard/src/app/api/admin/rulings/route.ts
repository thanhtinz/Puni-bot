import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { createRuling, deleteRuling, setExists, speciesExists, updateRuling, type RulingInput } from "@/lib/rulings";
import { SHOP_GAMES } from "@/lib/shop";

export const dynamic = "force-dynamic";

/** Rulings CRUD (Admin → Rulings). The action field must match
 * exactly; anything else is an error, never a default branch. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const back = (qs: string) => NextResponse.redirect(new URL(`/admin/rulings?${qs}`, req.url), 303);
  const fail = (msg: string) => back("err=" + encodeURIComponent(msg));

  if (action === "delete") {
    const id = Number.parseInt(String(form.get("id") ?? ""), 10);
    if (!Number.isInteger(id)) return fail("Thiếu mã ruling.");
    await deleteRuling(id);
    return back("saved=1");
  }
  if (action !== "save") return fail("Thao tác không hợp lệ.");

  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  const body = String(form.get("body") ?? "").trim().slice(0, 4000);
  const source = String(form.get("source") ?? "").trim().slice(0, 300);
  if (!title) return fail("Thiếu tiêu đề ruling.");
  if (!body) return fail("Thiếu nội dung ruling.");

  const speciesId = String(form.get("species_id") ?? "").trim().toLowerCase();
  const setId = String(form.get("set_id") ?? "").trim();
  const gamePrefix = String(form.get("game_prefix") ?? "").trim();
  const targets = [speciesId, setId, gamePrefix].filter(Boolean).length;
  if (targets !== 1) return fail("Ruling phải gắn đúng MỘT phạm vi: một loài, một bộ, hoặc một game.");

  const input: RulingInput = {
    speciesId: null, setId: null, gamePrefix: "", title, body, source,
  };
  if (speciesId) {
    if (!(await speciesExists(speciesId))) return fail(`Không thấy loài ${speciesId}.`);
    input.speciesId = speciesId;
  } else if (setId) {
    if (!(await setExists(setId))) return fail(`Không thấy bộ ${setId}.`);
    input.setId = setId;
  } else {
    if (!SHOP_GAMES.some((g) => g.prefix === gamePrefix)) return fail("Game không hợp lệ.");
    input.gamePrefix = gamePrefix;
  }

  const idRaw = String(form.get("id") ?? "").trim();
  if (idRaw) {
    const id = Number.parseInt(idRaw, 10);
    if (!Number.isInteger(id)) return fail("Mã ruling không hợp lệ.");
    await updateRuling(id, input);
  } else {
    await createRuling(input);
  }
  return back("saved=1");
}

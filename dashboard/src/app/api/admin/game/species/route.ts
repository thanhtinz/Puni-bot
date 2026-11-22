import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { deleteSpecies, setSpeciesEnabled, upsertSpecies } from "@/lib/db";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;
const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical", "Fabled"];

function stat(form: FormData, name: string): number {
  const n = Number.parseInt(String(form.get(name) ?? ""), 10);
  if (!Number.isFinite(n)) return 50;
  return Math.min(Math.max(n, 1), 999);
}

/** Species CRUD (Admin → Pet). The action field must match exactly. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const id = String(form.get("id") ?? "").trim().toLowerCase();
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/admin/pets?${qs}`, req.url), 303);
  const fail = (msg: string) => back("err=" + encodeURIComponent(msg));

  if (action === "delete") {
    if (!SLUG.test(id)) return fail("Mã pet không hợp lệ.");
    await deleteSpecies(id);
    return back("saved=1");
  }
  if (action === "toggle") {
    if (!SLUG.test(id)) return fail("Mã pet không hợp lệ.");
    await setSpeciesEnabled(id, form.get("enabled") != null);
    return back("saved=1");
  }
  if (action !== "save") return fail("Thao tác không hợp lệ.");
  if (!SLUG.test(id)) return fail("Mã pet phải là chữ thường/số/dấu gạch ngang, 2–41 ký tự.");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!name) return fail("Thiếu tên pet.");
  const rarity = String(form.get("rarity") ?? "Common");
  await upsertSpecies({
    id,
    name,
    types: String(form.get("types") ?? "").trim().slice(0, 120),
    rarity: RARITIES.includes(rarity) ? rarity : "Common",
    base_hp: stat(form, "base_hp"),
    base_atk: stat(form, "base_atk"),
    base_def: stat(form, "base_def"),
    base_spd: stat(form, "base_spd"),
    description: String(form.get("description") ?? "").trim().slice(0, 500),
    sprite_url: String(form.get("sprite_url") ?? "").trim().slice(0, 500),
    member_exclusive: form.get("member_exclusive") != null,
    enabled: form.get("enabled") != null,
  });
  return back("saved=1");
}

import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import {
  BANNER_KINDS, createBanner, deleteBanner, getBannerAdmin, missingSpecies,
  setBannerEnabled, updateBanner, type BannerInput, type BannerKind,
} from "@/lib/banners-admin";
import { SHOP_GAMES } from "@/lib/shop";

export const dynamic = "force-dynamic";

/**
 * Banner CRUD (Admin → Banner gacha). The action field must match
 * exactly one known verb; anything else is an error, never a default
 * branch (money-safety rule).
 */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const back = (qs: string) => NextResponse.redirect(new URL(`/admin/banners?${qs}`, req.url), 303);
  const fail = (msg: string) => back("err=" + encodeURIComponent(msg));

  if (action === "toggle" || action === "delete") {
    const id = String(form.get("id") ?? "").trim();
    const current = id ? await getBannerAdmin(id) : null;
    if (!current) return fail("Không thấy banner đó.");
    if (action === "toggle") {
      await setBannerEnabled(id, !current.enabled);
      return back("saved=1");
    }
    const out = await deleteBanner(id);
    return out.ok ? back("saved=1") : fail(out.error ?? "Không xoá được banner.");
  }
  if (action !== "save") return fail("Thao tác không hợp lệ.");

  const id = String(form.get("id") ?? "").trim().toLowerCase();
  const originalId = String(form.get("original_id") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const kind = String(form.get("kind") ?? "");
  const costRaw = Number.parseInt(String(form.get("cost_coins") ?? ""), 10);
  const poolPrefix = String(form.get("pool_prefix") ?? "").trim();
  const imageUrl = String(form.get("image_url") ?? "").trim().slice(0, 500);

  if (!name) return fail("Thiếu tên banner.");
  if (!(BANNER_KINDS as readonly string[]).includes(kind)) return fail("Loại banner không hợp lệ.");
  if (!Number.isInteger(costRaw) || costRaw < 0 || costRaw > 10_000_000) {
    return fail("Giá mở phải là số nguyên từ 0 tới 10.000.000 Coins.");
  }
  if (poolPrefix && !SHOP_GAMES.some((g) => g.prefix === poolPrefix)) {
    return fail("Họ thẻ của pool không hợp lệ.");
  }
  const parseList = (raw: string): string[] => [
    ...new Set(
      raw.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean),
    ),
  ].slice(0, 500);
  const poolSpecies = parseList(String(form.get("pool_species") ?? ""));
  const featuredSpecies = parseList(String(form.get("featured_species") ?? ""));
  const missing = await missingSpecies([...poolSpecies, ...featuredSpecies]);
  if (missing.length) {
    return fail(`Không thấy loài: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}`);
  }
  const parseDate = (raw: string): Date | null => {
    const v = raw.trim();
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const startsAt = parseDate(String(form.get("starts_at") ?? ""));
  const endsAt = parseDate(String(form.get("ends_at") ?? ""));
  if (startsAt && endsAt && endsAt <= startsAt) {
    return fail("Ngày kết thúc phải sau ngày bắt đầu.");
  }

  const input: BannerInput = {
    name,
    kind: kind as BannerKind,
    costCoins: costRaw,
    poolPrefix: poolPrefix || null,
    poolSpecies,
    featuredSpecies,
    imageUrl: imageUrl || null,
    startsAt,
    endsAt,
  };

  if (originalId) {
    // Editing: the id itself never changes (pity rows reference it).
    if (!(await getBannerAdmin(originalId))) return fail("Không thấy banner đó.");
    await updateBanner(originalId, input);
    return back("saved=1");
  }
  if (!/^[a-z0-9][a-z0-9-_]{0,39}$/.test(id)) {
    return fail("Mã banner chỉ gồm chữ thường, số, dấu - và _, tối đa 40 ký tự.");
  }
  if (await getBannerAdmin(id)) return fail(`Mã banner "${id}" đã tồn tại.`);
  await createBanner(id, input);
  return back("saved=1");
}

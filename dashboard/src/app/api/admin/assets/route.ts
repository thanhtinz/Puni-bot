import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { setSiteSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

const FIELDS: { field: string; reset: string; key: string; maxBytes: number }[] = [
  { field: "logo_file", reset: "reset_logo", key: "asset_logo", maxBytes: 500_000 },
  { field: "coins_file", reset: "reset_coins", key: "asset_coins_icon", maxBytes: 300_000 },
  { field: "gems_file", reset: "reset_gems", key: "asset_gems_icon", maxBytes: 300_000 },
];

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Upload/reset the owner-customized brand assets (logo, coin icon, gem
 *  icon). Stored as data URIs in site_settings and served by
 *  /api/assets/[key] — the site itself hardcodes none of them. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  for (const f of FIELDS) {
    if (form.get(f.reset) != null) {
      await setSiteSetting(f.key, "");
      continue;
    }
    const file = form.get(f.field);
    if (file instanceof File && file.size > 0) {
      if (!ALLOWED.has(file.type) || file.size > f.maxBytes) {
        return NextResponse.redirect(new URL("/admin/website?saved=invalid-image", req.url), 303);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      await setSiteSetting(f.key, `data:${file.type};base64,${buf.toString("base64")}`);
    }
  }
  return NextResponse.redirect(new URL("/admin/website?saved=1", req.url), 303);
}

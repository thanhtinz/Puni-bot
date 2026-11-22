import { NextResponse } from "next/server";
import { getSiteSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

const KEYS: Record<string, string> = {
  logo: "asset_logo",
  "coins-icon": "asset_coins_icon",
  "gems-icon": "asset_gems_icon",
};

/** Serves owner-uploaded brand assets (Admin panel → Trang web). Stored
 *  as data URIs in site_settings; nothing about them is hardcoded. The
 *  logo falls back to the bundled /logo.jpg when no upload exists. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const settingKey = KEYS[key];
  if (!settingKey) return new NextResponse("not found", { status: 404 });
  const stored = await getSiteSetting(settingKey).catch(() => null);
  if (stored && stored.startsWith("data:")) {
    const comma = stored.indexOf(",");
    const meta = stored.slice(5, comma);
    const mime = meta.split(";")[0] || "image/png";
    const bytes = Buffer.from(stored.slice(comma + 1), "base64");
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=300",
      },
    });
  }
  if (key === "logo") {
    return NextResponse.redirect(new URL("/logo.jpg", _req.url));
  }
  return new NextResponse("not found", { status: 404 });
}

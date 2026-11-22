import { NextRequest, NextResponse } from "next/server";

// Same-origin proxy for card artwork. The species art lives on a
// small set of known CDNs (TCGplayer via APITCG, TCGSDK, APITCG's
// own host); serving it through here keeps every surface loading
// even where the CDN blocks hotlinking, and lets the browser cache
// one immutable copy. The host allowlist is the SSRF guard —
// anything else is refused.
const ALLOWED_HOSTS = new Set([
  "tcgplayer-cdn.tcgplayer.com",
  "tcgsdk.com",
  "api.apitcg.com",
]);

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u") ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new NextResponse("bad url", { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    return new NextResponse("host not allowed", { status: 403 });
  }
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "PuniBot/1.0" },
    });
    if (!res.ok) return new NextResponse("upstream error", { status: 502 });
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) {
      return new NextResponse("not an image", { status: 502 });
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new NextResponse("fetch failed", { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";

// Animated Pokémon sprites (Pokémon Showdown's ani set, Gen-5 style)
// proxied same-origin so the arena never hotlinks and a missing
// sprite degrades to a plain 404 the client hides. Cached hard:
// sprite files are immutable.
const SLUG_RE = /^[a-z0-9-]{1,60}$/;

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!SLUG_RE.test(slug)) {
    return new NextResponse("bad slug", { status: 400 });
  }
  for (const set of ["ani", "gen5ani"]) {
    try {
      const res = await fetch(
        `https://play.pokemonshowdown.com/sprites/${set}/${slug}.gif`,
        { headers: { "User-Agent": "PuniBot/1.0" } },
      );
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return new NextResponse(buf, {
          headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "public, max-age=604800, immutable",
          },
        });
      }
    } catch {
      // try the next set, then 404
    }
  }
  return new NextResponse("not found", { status: 404 });
}

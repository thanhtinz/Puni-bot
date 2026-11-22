/**
 * Profile card renderer (spec 6.39): draws the player's card after
 * the owner's sample (1290x860) — countryside scene band with a big
 * farmhouse, slanted name tab, big avatar frame, rank tier as "Lv"
 * with an MMR progress bar, a pinned info panel, Coins / Shards
 * pills and the active deck's first 5 cards in the ribboned team
 * panel ("Chưa có đội hình" when empty). SVG is composed here and
 * rasterised with sharp; the Baloo 2 / Be Vietnam Pro TTFs in
 * src/assets/fonts are registered through a bundled fontconfig so
 * the render matches the site's typography.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, getUserEconomy } from "./db";
import { getProfile } from "./player";

if (!process.env.FONTCONFIG_FILE) {
  process.env.FONTCONFIG_FILE = path.join(
    process.cwd(), "src", "assets", "fonts", "fonts.conf",
  );
}

const W = 1290;
const H = 860;
const TEAL = "#3d6b74";
const INK = "#101010";

const TIERS = [
  { name: "Đồng", min: 0 },
  { name: "Bạc", min: 1100 },
  { name: "Vàng", min: 1250 },
  { name: "Bạch Kim", min: 1450 },
  { name: "Kim Cương", min: 1700 },
  { name: "Cao Thủ", min: 2000 },
];

export interface ProfileCardData {
  username: string;
  userId: string;
  avatarUrl: string | null;
  coins: number;
  shards: number;
  mmr: number;
  gender: string;
  birthday: string | null;
  hobby: string;
  statusText: string;
  team: Array<{ name: string; spriteUrl: string }>;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;");
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

export async function profileCardData(
  userId: string,
  username: string,
  avatarHash: string | null,
): Promise<ProfileCardData> {
  const [economy, profile, walletRes, rankedRes, teamRes] =
    await Promise.all([
      getUserEconomy(userId).catch(() => null),
      getProfile(userId).catch(() => ({ gender: "", birthday: null, hobby: "", statusText: "" })),
      db().query(`SELECT shards FROM tcg_wallets WHERE user_id = $1`, [userId]).catch(() => null),
      db().query(`SELECT mmr FROM tcg_ranked_profiles WHERE user_id = $1`, [userId]).catch(() => null),
      db().query(
        `SELECT s.name, s.sprite_url
         FROM tcg_decks d
         JOIN tcg_deck_cards dc ON dc.deck_id = d.id
         JOIN tcg_instances i ON i.code = dc.instance_code
         JOIN game_species s ON s.id = i.species_id
         WHERE d.user_id = $1 AND d.is_active
         ORDER BY dc.instance_code LIMIT 5`,
        [userId],
      ).catch(() => null),
    ]);
  return {
    username,
    userId,
    avatarUrl: avatarHash
      ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=256`
      : null,
    coins: economy?.balance ?? 0,
    shards: Number(walletRes?.rows[0]?.shards ?? 0),
    mmr: Number(rankedRes?.rows[0]?.mmr ?? 1000),
    gender: profile.gender,
    birthday: profile.birthday,
    hobby: profile.hobby,
    statusText: profile.statusText,
    team: (teamRes?.rows ?? []).map((r) => ({
      name: String((r as { name: string }).name),
      spriteUrl: String((r as { sprite_url: string | null }).sprite_url ?? ""),
    })),
  };
}

async function fetchImageDataUri(url: string): Promise<string | null> {
  try {
    if (url.startsWith("/")) {
      const buf = await readFile(path.join(process.cwd(), "public", url));
      const ext = url.endsWith(".png") ? "png" : "jpeg";
      return `data:image/${ext};base64,${buf.toString("base64")}`;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function tierOf(mmr: number): { name: string; progress: number } {
  let cur = TIERS[0]!;
  let next: (typeof TIERS)[number] | null = null;
  for (const t of TIERS) {
    if (mmr >= t.min) cur = t;
    else if (!next) next = t;
  }
  if (!next) return { name: cur.name, progress: 1 };
  return {
    name: cur.name,
    progress: Math.min(1, Math.max(0, (mmr - cur.min) / (next.min - cur.min))),
  };
}

export async function renderProfileCard(data: ProfileCardData): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const [sceneA, sceneB] = await Promise.all([
    readFile(path.join(process.cwd(), "public", "profile-scene-a.jpg")),
    readFile(path.join(process.cwd(), "public", "profile-scene-b.jpg")),
  ]);
  const sceneUriA = `data:image/jpeg;base64,${sceneA.toString("base64")}`;
  const sceneUriB = `data:image/jpeg;base64,${sceneB.toString("base64")}`;
  const [avatarUri, ...teamUris] = await Promise.all([
    data.avatarUrl ? fetchImageDataUri(data.avatarUrl) : Promise.resolve(null),
    ...data.team.map((c) => fetchImageDataUri(c.spriteUrl)),
  ]);
  const tier = tierOf(data.mmr);
  const barW = 682;
  const fillW = Math.round((barW - 8) * tier.progress);
  const nameSize = data.username.length > 20 ? 44 : data.username.length > 13 ? 54 : 66;

  const birthday = data.birthday
    ? new Date(`${data.birthday}T00:00:00`).toLocaleDateString("vi-VN")
    : "—";
  const infoRows: Array<[string, string]> = [
    ["Giới tính:", data.gender || "—"],
    ["Ngày sinh:", birthday],
    ["Sở thích:", data.hobby || "—"],
    ["Mối quan hệ:", data.statusText || "—"],
  ];

  const teamSvg = data.team.length
    ? data.team.map((c, i) => {
        const x = 670 + i * 112;
        const uri = teamUris[i];
        const label = c.name.length > 12 ? `${c.name.slice(0, 11)}…` : c.name;
        return `
          ${uri
            ? `<image href="${uri}" x="${x}" y="640" width="100" height="138" preserveAspectRatio="xMidYMid slice" clip-path="url(#teamClip${i})"/>
               <clipPath id="teamClip${i}"><rect x="${x}" y="640" width="100" height="138" rx="9"/></clipPath>`
            : `<rect x="${x}" y="640" width="100" height="138" rx="9" fill="#d7dee8"/>`}
          <rect x="${x}" y="640" width="100" height="138" rx="9" fill="none" stroke="${INK}" stroke-width="3"/>
          <text x="${x + 50}" y="802" text-anchor="middle" font-family="Be Vietnam Pro" font-weight="700" font-size="15" fill="#ffffff">${esc(label)}</text>`;
      }).join("")
    : `<text x="959" y="712" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="40" fill="#ffffff">Chưa có đội hình</text>`;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${TEAL}"/>
  <image href="${sceneUriA}" x="0" y="0" width="645" height="340"/>
  <image href="${sceneUriB}" x="645" y="0" width="645" height="340"/>
  <rect x="0" y="336" width="${W}" height="${H - 336}" fill="${TEAL}"/>

  <!-- Slanted name tab (the sample's signature shape) -->
  <path d="M362 188 L736 188 Q768 188 786 234 L820 316 Q828 340 804 340 L362 340 Z" fill="${TEAL}"/>

  <!-- Avatar frame -->
  <rect x="20" y="14" width="336" height="336" rx="38" fill="${INK}"/>
  ${avatarUri
    ? `<image href="${avatarUri}" x="30" y="24" width="316" height="316" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>
       <clipPath id="avatarClip"><rect x="30" y="24" width="316" height="316" rx="30"/></clipPath>`
    : `<rect x="30" y="24" width="316" height="316" rx="30" fill="#d7dee8"/>`}

  <!-- Name / ID / rank -->
  <text x="392" y="260" font-family="Baloo 2" font-weight="800" font-size="${nameSize}" fill="#ffffff">${esc(data.username)}</text>
  <text x="438" y="310" font-family="Be Vietnam Pro" font-weight="700" font-size="28" fill="#ffffff">Id: ${esc(data.userId)}</text>
  <text x="372" y="384" font-family="Baloo 2" font-weight="800" font-size="44" fill="#ffffff">Lv: ${esc(tier.name)}</text>
  <text x="1050" y="384" text-anchor="end" font-family="Be Vietnam Pro" font-weight="700" font-size="26" fill="#ffffff">EXP: ${fmt(data.mmr)} MMR</text>
  <rect x="368" y="396" width="${barW}" height="24" rx="12" fill="#d9e1e7" stroke="${INK}" stroke-width="3.5"/>
  ${fillW > 6 ? `<rect x="372" y="400" width="${fillW}" height="16" rx="8" fill="#ffd83d"/>` : ""}

  <!-- Info panel -->
  <rect x="20" y="478" width="606" height="338" rx="26" fill="${TEAL}" stroke="${INK}" stroke-width="4"/>
  <circle cx="601" cy="475" r="15" fill="#a31f1f"/>
  <circle cx="595" cy="469" r="15" fill="#e0332e"/>
  <circle cx="590" cy="464" r="5" fill="#ff9d97"/>
  ${infoRows.map(([label, value], i) => {
    const y = 550 + i * 78;
    return `
      <text x="66" y="${y}" font-family="Be Vietnam Pro" font-weight="700" font-size="30" fill="#ffffff">${esc(label)}</text>
      <text x="272" y="${y}" font-family="Be Vietnam Pro" font-weight="500" font-size="28" fill="#eef7f8">${esc(value)}</text>
      <line x1="66" y1="${y + 15}" x2="556" y2="${y + 15}" stroke="${INK}" stroke-width="2.5"/>`;
  }).join("")}

  <!-- Currency pills -->
  <rect x="648" y="486" width="302" height="64" rx="16" fill="${TEAL}" stroke="${INK}" stroke-width="3.5"/>
  <circle cx="694" cy="518" r="23" fill="#ffc93d" stroke="#c47f0a" stroke-width="3.5"/>
  <path d="M694 532 C694 521 688 517 681 513 C688 511 694 513 696 517 C698 511 706 509 712 513 C704 517 698 523 694 532 Z" fill="#35b558"/>
  <text x="730" y="529" font-family="Be Vietnam Pro" font-weight="900" font-size="30" fill="#ffffff">${fmt(data.coins)}</text>
  <rect x="968" y="486" width="302" height="64" rx="16" fill="${TEAL}" stroke="${INK}" stroke-width="3.5"/>
  <path d="M1014 496 L1034 510 L1026 542 L1002 542 L994 510 Z" fill="#b388ff" stroke="#5e35b1" stroke-width="3"/>
  <path d="M994 510 L1034 510 M1014 496 L1008 510 L1014 542 M1014 496 L1020 510 L1014 542" stroke="#5e35b1" stroke-width="2" fill="none"/>
  <text x="1052" y="529" font-family="Be Vietnam Pro" font-weight="900" font-size="30" fill="#ffffff">${fmt(data.shards)}</text>

  <!-- Team panel -->
  <rect x="648" y="578" width="622" height="238" rx="26" fill="${TEAL}" stroke="${INK}" stroke-width="4"/>
  <path d="M690 566 L732 566 L732 648 L711 627 L690 648 Z" fill="#f2b134" stroke="${INK}" stroke-width="3"/>
  ${teamSvg}
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

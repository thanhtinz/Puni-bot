/**
 * Profile card renderer (spec 6.39): draws the player's card after
 * the owner's sample (1290x860) — countryside scene band, big avatar
 * frame, name + ID, rank tier as "Lv" with an MMR progress bar,
 * a pinned info panel, Coins / Shards pills and the active deck's
 * first 5 cards in the team panel ("Chưa có đội hình" when empty).
 * SVG is composed here and rasterised with sharp; the Baloo 2 /
 * Be Vietnam Pro TTFs in src/assets/fonts are registered through a
 * bundled fontconfig so the render matches the site's typography.
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
const TEAL = "#336f7a";
const TEAL_DARK = "#2b5f6a";
const INK = "#0b0b0b";

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
  const barW = 660;
  const fillW = Math.round((barW - 10) * tier.progress);

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
        const x = 672 + i * 118;
        const uri = teamUris[i];
        const label = c.name.length > 11 ? `${c.name.slice(0, 10)}…` : c.name;
        return `
          ${uri
            ? `<image href="${uri}" x="${x}" y="618" width="104" height="146" preserveAspectRatio="xMidYMid slice" clip-path="url(#teamClip${i})"/>
               <clipPath id="teamClip${i}"><rect x="${x}" y="618" width="104" height="146" rx="10"/></clipPath>`
            : `<rect x="${x}" y="618" width="104" height="146" rx="10" fill="#d7dee8"/>`}
          <rect x="${x}" y="618" width="104" height="146" rx="10" fill="none" stroke="${INK}" stroke-width="3"/>
          <text x="${x + 52}" y="792" text-anchor="middle" font-family="Be Vietnam Pro" font-weight="700" font-size="15" fill="#ffffff">${esc(label)}</text>`;
      }).join("")
    : `<text x="959" y="722" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="42" fill="#ffffff">Chưa có đội hình</text>`;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${TEAL}"/>
  <image href="${sceneUriA}" x="0" y="0" width="645" height="400"/>
  <image href="${sceneUriB}" x="645" y="0" width="645" height="400"/>
  <rect x="0" y="330" width="${W}" height="${H - 330}" fill="${TEAL}"/>
  <rect x="345" y="192" width="540" height="150" rx="30" fill="${TEAL}"/>

  <!-- Avatar frame -->
  <rect x="22" y="32" width="330" height="330" rx="40" fill="${INK}"/>
  ${avatarUri
    ? `<image href="${avatarUri}" x="32" y="42" width="310" height="310" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>
       <clipPath id="avatarClip"><rect x="32" y="42" width="310" height="310" rx="32"/></clipPath>`
    : `<rect x="32" y="42" width="310" height="310" rx="32" fill="#d7dee8"/>
       <text x="187" y="248" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="150" fill="#7d8aa0">${esc((data.username || "?").slice(0, 1).toUpperCase())}</text>`}

  <!-- Name / ID / rank -->
  <text x="385" y="262" font-family="Baloo 2" font-weight="800" font-size="64" fill="#ffffff">${esc(data.username)}</text>
  <text x="432" y="312" font-family="Be Vietnam Pro" font-weight="700" font-size="29" fill="#ffffff">Id: ${esc(data.userId)}</text>
  <text x="375" y="398" font-family="Baloo 2" font-weight="800" font-size="42" fill="#ffffff">Lv: ${esc(tier.name)}</text>
  <text x="1035" y="398" text-anchor="end" font-family="Be Vietnam Pro" font-weight="700" font-size="27" fill="#ffffff">EXP: ${fmt(data.mmr)} MMR</text>
  <rect x="365" y="415" width="${barW}" height="36" rx="18" fill="#ccd6dd" stroke="${INK}" stroke-width="5"/>
  ${fillW > 4 ? `<rect x="370" y="420" width="${fillW}" height="26" rx="13" fill="#ffd83d"/>` : ""}

  <!-- Info panel -->
  <rect x="22" y="480" width="590" height="355" rx="28" fill="${TEAL_DARK}" stroke="${INK}" stroke-width="5"/>
  <circle cx="588" cy="472" r="17" fill="#e5484d" stroke="${INK}" stroke-width="4"/>
  <circle cx="600" cy="460" r="10" fill="#ff6b6f" stroke="${INK}" stroke-width="3"/>
  ${infoRows.map(([label, value], i) => {
    const y = 552 + i * 76;
    return `
      <text x="55" y="${y}" font-family="Be Vietnam Pro" font-weight="700" font-size="29" fill="#ffffff">${esc(label)}</text>
      <text x="262" y="${y}" font-family="Be Vietnam Pro" font-weight="500" font-size="27" fill="#eaf6f8">${esc(value)}</text>
      <line x1="55" y1="${y + 16}" x2="565" y2="${y + 16}" stroke="${INK}" stroke-width="3"/>`;
  }).join("")}

  <!-- Currency pills -->
  <rect x="650" y="480" width="300" height="80" rx="20" fill="${TEAL_DARK}" stroke="${INK}" stroke-width="5"/>
  <circle cx="702" cy="520" r="27" fill="#ffc93d" stroke="#b97a0c" stroke-width="4"/>
  <path d="M702 534 C702 522 696 518 688 514 C696 512 702 514 704 518 C706 512 714 510 720 514 C712 518 706 524 702 534 Z" fill="#35b558"/>
  <text x="745" y="532" font-family="Be Vietnam Pro" font-weight="900" font-size="29" fill="#ffffff">${fmt(data.coins)}</text>
  <rect x="968" y="480" width="300" height="80" rx="20" fill="${TEAL_DARK}" stroke="${INK}" stroke-width="5"/>
  <path d="M1020 494 L1040 508 L1032 540 L1008 540 L1000 508 Z" fill="#b388ff" stroke="#5e35b1" stroke-width="3"/>
  <path d="M1000 508 L1040 508 M1020 494 L1014 508 L1020 540 M1020 494 L1026 508 L1020 540" stroke="#5e35b1" stroke-width="2" fill="none"/>
  <text x="1058" y="532" font-family="Be Vietnam Pro" font-weight="900" font-size="29" fill="#ffffff">${fmt(data.shards)}</text>

  <!-- Team panel -->
  <rect x="650" y="585" width="618" height="250" rx="28" fill="${TEAL_DARK}" stroke="${INK}" stroke-width="5"/>
  <path d="M692 568 L726 568 L726 640 L709 622 L692 640 Z" fill="#f2b134" stroke="${INK}" stroke-width="3"/>
  ${teamSvg}
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

import type { ShowcaseCard } from "@/lib/showcase";
import { fmtCoins } from "@/lib/player";
import { RARITY_VI } from "@/lib/tcg";

/** Shared showcase stage (spec 6.30) — used by the owner editor at
 *  /me/showcase and the public page /showcase/<id>. Pure server
 *  component; theming/effects are CSS classes on the stage. */
const RARE_SET = new Set(["Epic", "Legendary", "Mythical", "Fabled"]);

export function ShowcaseStage({
  cards, layout, theme, effect, title, subtitle,
}: {
  cards: ShowcaseCard[];
  layout: string;
  theme: string;
  effect: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className={`sc-stage sc-layout-${layout} sc-fx-${effect}`} data-theme={theme}>
      <header className="sc-head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      {cards.length === 0 ? (
        <p className="sc-empty">Chưa có thẻ nào được ghim lên trang trưng bày.</p>
      ) : (
        <div className="sc-grid">
          {cards.map((c, i) => (
            <article key={c.code} className={`sc-card${i === 0 && layout === "spotlight" ? " sc-card-hero" : ""}`} data-rare={RARE_SET.has(c.rarity) ? "1" : undefined}>
              {c.spriteUrl ? <img src={c.spriteUrl} alt={c.name} loading="lazy" /> : null}
              <div className="sc-card-info">
                <strong>{c.name}</strong>
                <span className={`mk-rar rar-${c.rarity.toLowerCase()}`}>{RARITY_VI[c.rarity] ?? c.rarity}</span>
                <span className="sc-card-meta">Lv.{c.level} +{c.enhance} · {fmtCoins(c.value)} Coins</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SlabCard, { gradeForRarity } from "@/components/slab-card";
import CardArt from "@/components/card-art";
import CardBack from "@/components/card-back";

export interface RevealCard {
  code: string;
  speciesId: string;
  name: string;
  rarity: string;
  rarityVi: string;
  /** Sell-back value in Coins at the current system rate. */
  value: number;
  /** Real artwork URL from game_species.sprite_url. */
  spriteUrl: string;
  /** Set display name, e.g. "OP01 – Romance Dawn". */
  setLabel: string;
}

type Phase = "sealed" | "tearing" | "flipping" | "done";

const RARITY_RANK = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical", "Fabled"];
const rankOf = (r: string) => Math.max(0, RARITY_RANK.indexOf(r));

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/** One set name when the whole pack comes from a single set. */
function packSetLabel(cards: RevealCard[]): string {
  const labels = [...new Set(cards.map((c) => c.setLabel).filter(Boolean))];
  if (labels.length === 1) return labels[0];
  if (labels.length > 1) return "Nhiều bộ thẻ";
  return "Thẻ TCG";
}

/**
 * Pack-opening ceremony the way real TCG apps do it (Pokémon TCG
 * Pocket / Master Duel): tear the foil pack, the cards fan out
 * face-down, then flip them ONE BY ONE — weakest first, the hit
 * last — with a rarity burst for Epic and a full-stage flash +
 * banner for Legendary and above. Ends on the summary (total
 * sell-back count-up, best-card spotlight, full grid).
 * Pure presentation — the pull itself already happened server-side.
 */
export default function PackReveal({ cards }: { cards: RevealCard[] }) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [flipped, setFlipped] = useState(0);
  const [shown, setShown] = useState(0);
  const [burst, setBurst] = useState<{ key: number; rarity: string; rarityVi: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = useMemo(() => cards.reduce((s, c) => s + c.value, 0), [cards]);
  /** Ceremony order: ascending rarity, stable — the best card flips last. */
  const order = useMemo(
    () => cards.map((c, i) => ({ c, i })).sort((x, y) => rankOf(x.c.rarity) - rankOf(y.c.rarity) || x.i - y.i).map((x) => x.c),
    [cards],
  );
  const best = useMemo(() => (order.length ? order[order.length - 1] : null), [order]);
  const rest = useMemo(() => (best ? cards.filter((c) => c.code !== best.code) : cards), [cards, best]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (doneTimer.current) clearTimeout(doneTimer.current);
  }, []);

  useEffect(() => {
    if (phase !== "done") return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(total);
      return;
    }
    const start = performance.now();
    const dur = 1150;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      // Keep the 4-decimal money scale while counting up (spec 6.29).
      setShown(Math.round(total * (1 - Math.pow(1 - k, 3)) * 10000) / 10000);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, total]);

  const tear = () => {
    if (phase !== "sealed") return;
    setPhase("tearing");
    timer.current = setTimeout(() => {
      if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setFlipped(order.length);
        setPhase("done");
      } else {
        setPhase("flipping");
      }
    }, 1000);
  };

  const flipNext = () => {
    if (phase !== "flipping" || flipped >= order.length) return;
    const card = order[flipped];
    const next = flipped + 1;
    setFlipped(next);
    if (rankOf(card.rarity) >= 2) {
      setBurst({ key: Date.now(), rarity: card.rarity, rarityVi: card.rarityVi });
    }
    if (next >= order.length) {
      doneTimer.current = setTimeout(() => setPhase("done"), 1250);
    }
  };

  const flipAll = () => {
    if (phase !== "flipping") return;
    setFlipped(order.length);
    if (best && rankOf(best.rarity) >= 2) {
      setBurst({ key: Date.now(), rarity: best.rarity, rarityVi: best.rarityVi });
    }
    doneTimer.current = setTimeout(() => setPhase("done"), 900);
  };

  return (
    <section className="gacha-reveal">
      <h2>Thẻ vừa mở</h2>
      <div className="rip-stage">
        {phase === "sealed" || phase === "tearing" ? (
          <>
            <button
              type="button"
              className={`pack2 ${phase === "tearing" ? "tearing" : ""}`}
              onClick={tear}
              aria-label="Xé gói thẻ"
            >
              <span className="pack2-half pack2-half-left" aria-hidden="true" />
              <span className="pack2-half pack2-half-right" aria-hidden="true" />
              <img src="/pack-tuxemon.png" alt="Gói thẻ Puni" className="pack2-img" draggable={false} />
              <span className="pack2-flash" aria-hidden="true" />
            </button>
            <div className="rip-pack-name">GÓI THẺ PUNI</div>
            <div className="rip-pack-sub">{packSetLabel(cards)} · {cards.length} thẻ</div>
            {phase === "sealed" ? (
              <>
                <button type="button" className="rip-cta" onClick={tear}>
                  XÉ GÓI
                </button>
                <button
                  type="button"
                  className="rip-skip"
                  onClick={() => { setFlipped(order.length); setPhase("done"); }}
                >
                  Bỏ qua, xem thẻ luôn
                </button>
              </>
            ) : (
              <div className="rip-tearing-label">Đang xé gói…</div>
            )}
          </>
        ) : phase === "flipping" ? (
          <div className="flip-stage" onClick={flipNext}>
            {burst && rankOf(burst.rarity) >= 4 ? (
              <div key={burst.key} className={`flip-flash rarity-${burst.rarity.toLowerCase()}`} aria-hidden="true" />
            ) : null}
            {burst && rankOf(burst.rarity) >= 3 ? (
              <div key={`b${burst.key}`} className={`flip-banner rarity-${burst.rarity.toLowerCase()}`} aria-hidden="true">
                {burst.rarityVi.toUpperCase()}!
              </div>
            ) : null}
            <div className="flip-progress">
              Đã lật {flipped}/{order.length} — lá tốt nhất nằm cuối gói
            </div>
            <div className="flip-fan">
              {order.map((c, idx) => {
                const isFlipped = idx < flipped;
                const isNext = idx === flipped;
                return (
                  <div
                    key={c.code}
                    className={`flip-tile rarity-${c.rarity.toLowerCase()} ${isFlipped ? "is-flipped" : ""} ${isNext ? "is-next" : ""}`}
                    style={{ transitionDelay: "0s" }}
                  >
                    <div className="flip-tile-inner">
                      <div className="flip-face flip-back">
                        <CardBack />
                      </div>
                      <div className="flip-face flip-front">
                        <CardArt src={c.spriteUrl} alt={c.name} rarity={c.rarity} />
                        {isFlipped && rankOf(c.rarity) >= 2 ? (
                          <span className="flip-rarity-chip">{c.rarityVi}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flip-name">{isFlipped ? c.name : "???"}</div>
                  </div>
                );
              })}
            </div>
            <div className="flip-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="rip-cta" onClick={flipNext}>
                {flipped === 0 ? "Lật lá đầu tiên" : "Lật lá tiếp theo"}
              </button>
              <button type="button" className="rip-skip" onClick={flipAll}>
                Lật hết
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="rip-total-label">TỔNG GIÁ TRỊ BÁN LẠI</div>
            <div className="rip-total">
              {fmt(shown)} <span className="rip-total-unit">Coins</span>
            </div>
            <div className="rip-total-sub">{cards.length} thẻ mới đã vào kho của bạn</div>
            {best ? (
              <figure className={`spotlight rarity-${best.rarity.toLowerCase()}`}>
                <span className="spotlight-tag">LÁ TỐT NHẤT · {best.rarityVi.toUpperCase()}</span>
                {gradeForRarity(best.rarity) ? (
                  <SlabCard
                    imageUrl={best.spriteUrl}
                    name={best.name}
                    setLine={best.setLabel}
                    grade={gradeForRarity(best.rarity)!}
                    cert={best.code}
                  />
                ) : (
                  <CardArt src={best.spriteUrl} alt={best.name} rarity={best.rarity} />
                )}
                <figcaption>
                  <strong>{best.name}</strong>
                  <span>
                    Bán lại {fmt(best.value)} Coins · <code>{best.code}</code>
                  </span>
                </figcaption>
              </figure>
            ) : null}
            {rest.length ? (
              <div className="tcg-grid reveal-grid rip-grid">
                {rest.map((c, i) => (
                  <article
                    className={`tcg-card rarity-${c.rarity.toLowerCase()} reveal-card`}
                    key={c.code}
                    style={{ animationDelay: `${0.15 + i * 0.14}s` }}
                  >
                    <CardArt src={c.spriteUrl} alt={c.name} rarity={c.rarity} />
                    <div className="tcg-card-meta">
                      <strong>{c.name}</strong>
                      <span>
                        {c.rarityVi} · Bán lại {fmt(c.value)} Coins
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

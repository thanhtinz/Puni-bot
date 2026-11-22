"use client";

import { useEffect, useRef, useState } from "react";
import CardArt from "@/components/card-art";
import type { YugiohOutcome, YgoCardView } from "@/lib/yugioh";
import type { YgoEvent, YgoPosition } from "@/lib/yugioh-battle";

interface Mon {
  name: string;
  position: YgoPosition;
  dying?: boolean;
}
interface DuelSide {
  monsters: Mon[];
  hand: number;
  deck: number;
}


const emptySide = (deckSize: number): DuelSide => ({
  monsters: [],
  hand: 5,
  deck: Math.max(0, deckSize - 5),
});

/**
 * Yu-Gi-Oh arena (spec 6.39): replays the real-rules duel — LP bars
 * at 8000, monster zones with Attack/Defense positions (defense
 * cards lie sideways, as on a real playmat), tribute summons, bounce
 * damage off Defense Position and direct attacks on an empty field.
 * The result is already settled server-side.
 */
export default function YugiohArena({
  previewDeck,
  ready,
  count,
}: {
  previewDeck: YgoCardView[];
  ready: boolean;
  count: number;
}) {
  const [outcome, setOutcome] = useState<YugiohOutcome | null>(null);
  const [sides, setSides] = useState<{ a: DuelSide; b: DuelSide } | null>(null);
  const [lp, setLp] = useState<[number, number]>([8000, 8000]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [log, setLog] = useState("");
  const [hit, setHit] = useState<{ key: number; side: "a" | "b"; name: string } | null>(null);
  const [lunge, setLunge] = useState<{ key: number; side: "a" | "b"; name: string } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [turn, setTurn] = useState(1);
  const [lpFloat, setLpFloat] = useState<{ key: number; side: "a" | "b"; dmg: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const events = outcome?.events ?? [];
  const finished = outcome !== null && idx >= events.length;
  const viewOf = (side: "a" | "b", name: string): YgoCardView | undefined =>
    (side === "a" ? outcome?.deckA : outcome?.deckB)?.find((c) => c.name === name);

  const applyEvent = (e: YgoEvent, key: number, animate: boolean) => {
    setSides((prev) => {
      if (!prev) return prev;
      const next: { a: DuelSide; b: DuelSide } = {
        a: { ...prev.a, monsters: prev.a.monsters.filter((m) => !m.dying).map((m) => ({ ...m })) },
        b: { ...prev.b, monsters: prev.b.monsters.filter((m) => !m.dying).map((m) => ({ ...m })) },
      };
      const mine = next[e.side];
      switch (e.type) {
        case "draw":
          mine.hand += 1;
          mine.deck = Math.max(0, mine.deck - 1);
          break;
        case "tribute":
          for (const name of e.tributes ?? []) {
            const m = mine.monsters.find((x) => x.name === name && !x.dying);
            if (m) m.dying = true;
          }
          break;
        case "summon":
          mine.hand = Math.max(0, mine.hand - 1);
          mine.monsters.push({ name: e.card ?? "", position: e.position ?? "attack" });
          break;
        case "position": {
          const m = mine.monsters.find((x) => x.name === e.card);
          if (m && e.position) m.position = e.position;
          break;
        }
        case "destroy": {
          const m = mine.monsters.find((x) => x.name === e.card && !x.dying);
          if (m) m.dying = true;
          break;
        }
        default:
          break;
      }
      return next;
    });
    setLp([e.lpA, e.lpB]);
    setLog(e.text);
    setTurn(e.turn);
    if (animate) {
      if (e.type === "attack" && e.card && e.target) {
        setLunge({ key, side: e.side, name: e.card });
        setHit({ key, side: e.side === "a" ? "b" : "a", name: e.target });
      } else if (e.type === "lp" && e.damage) {
        setLpFloat({ key, side: e.side, dmg: e.damage });
      } else if (e.type === "direct") {
        setLpFloat(null);
        setHit(null);
      }
    }
  };

  useEffect(() => {
    if (!playing || finished || !outcome) return;
    const e = events[idx];
    if (!e) return;
    const base = e.type === "attack" || e.type === "destroy" || e.type === "summon" ? 700 : 380;
    timer.current = setTimeout(() => {
      applyEvent(e, idx, true);
      if (e.type === "destroy") setShakeKey(idx + 1);
      setIdx(idx + 1);
    }, base / speed);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, idx, finished, outcome]);

  const skip = () => {
    if (!outcome) return;
    for (let i = idx; i < events.length; i++) applyEvent(events[i]!, i, false);
    setIdx(events.length);
    setPlaying(false);
    setHit(null);
    setLunge(null);
    setLpFloat(null);
  };

  const fight = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/me/yugioh-battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fight" }),
      });
      const data = (await res.json()) as YugiohOutcome | { error: string };
      if (!res.ok || !("ok" in data)) {
        setError(("error" in data && data.error) || "Có lỗi, thử lại sau.");
        return;
      }
      setOutcome(data);
      setSides({ a: emptySide(data.deckA.length), b: emptySide(data.deckB.length) });
      setLp([8000, 8000]);
      setIdx(0);
      setHit(null);
      setLunge(null);
      setLpFloat(null);
      setLog("Trận đấu bắt đầu! LP 8000 – 8000.");
      setPlaying(true);
    } catch {
      setError("Có lỗi, thử lại sau.");
    } finally {
      setBusy(false);
    }
  };

  const renderMonsters = (sideKey: "a" | "b") => {
    if (!sides) return null;
    const side = sides[sideKey];
    return (
      <div className="ygo-zones">
        {[0, 1, 2, 3, 4].map((slot) => {
          const m = side.monsters[slot];
          if (!m) return <div key={slot} className="ygo-zone empty" />;
          const v = viewOf(sideKey, m.name);
          const isHit = hit?.side === sideKey && hit?.name === m.name && !finished;
          const isLunge = lunge?.side === sideKey && lunge?.name === m.name && !finished;
          return (
            <div
              key={slot}
              className={`ygo-zone filled${m.position === "defense" ? " is-defense" : ""}${m.dying ? " is-dying" : ""}${isHit ? " is-hit" : ""}${isLunge ? ` lunge-${sideKey}` : ""}`}
              title={m.name}
            >
              <CardArt src={v?.spriteUrl ?? ""} alt={m.name} className="ygo-mon-art" />
              <div className="ygo-mon-info">
                <strong>{m.name}</strong>
                <div className="ygo-statline">
                  <span className="ygo-stat">
                    {v?.link ? <b>{v?.atk ?? "?"}</b> : <><b>{v?.atk ?? "?"}</b><i>/</i><b>{v?.def ?? "?"}</b></>}
                  </span>
                  <span className="ygo-pos">{v?.link ? "Link" : m.position === "attack" ? "Thế công" : "Thế thủ"}</span>
                </div>
                <small>{v ? (v.link ? `Link Monster · ${v.attribute}` : `Lv${v.level} · ${v.attribute}`) : ""}</small>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderLp = (sideKey: "a" | "b", label: string) => {
    const value = Math.max(0, lp[sideKey === "a" ? 0 : 1]);
    return (
      <div className="ygo-lp">
        <span className="ygo-lp-label">{label}</span>
        <div className="ygo-lpbar">
          <span style={{ width: `${(value / 8000) * 100}%` }} />
        </div>
        <strong>{value.toLocaleString("en-US")} LP</strong>
        {lpFloat?.side === sideKey && !finished ? (
          <span className="ygo-lp-float" key={lpFloat.key}>-{lpFloat.dmg}</span>
        ) : null}
      </div>
    );
  };

  /** Spell/Trap zone row — framed empty slots behind the monsters,
   * as on a real playmat (the engine is monster-only for now). */
  const renderStRow = () => (
    <div className="ygo-strow" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="ygo-st-slot" />
      ))}
    </div>
  );

  /** Deck + hand piles at the edge of the mat, Cross Duel style. */
  const renderPiles = (sideKey: "a" | "b") => {
    if (!sides) return null;
    const s = sides[sideKey];
    return (
      <div className="ygo-piles">
        <div className="ygo-pile deck" title="Bộ bài còn lại">
          <span>{s.deck}</span>
          <small>Deck</small>
        </div>
        <div className="ygo-pile hand" title="Bài trên tay">
          <span>{s.hand}</span>
          <small>Tay</small>
        </div>
      </div>
    );
  };

  return (
    <div className="poke-wrap arena-bleed">
      {!outcome ? (
        <>
          <p className="ygo-deckline">
            Bộ bài của bạn: {count} lá có chỉ số thật (ATK/DEF gốc từ YGOPRODeck).
          </p>
          <div className="poke-team-preview">
            {previewDeck.slice(0, 5).map((c, i) => (
              <div key={i} className="poke-bench-card big">
                <CardArt src={c.spriteUrl} alt={c.name} className="poke-bench-art" />
                <small>{c.name}</small>
                <small>ATK {c.atk} · DEF {c.def} · Lv{c.level}</small>
              </div>
            ))}
          </div>
          {!ready ? (
            <p className="poke-hint">Cần ít nhất 10 lá Yu-Gi-Oh có chỉ số thật để đấu — mở thêm gói Yu-Gi-Oh ở trang Mở Thẻ nhé.</p>
          ) : null}
          <button type="button" className="btn-primary poke-fight-btn" disabled={!ready || busy} onClick={fight}>
            {busy ? "Đang xếp trận..." : "Bắt đầu đấu"}
          </button>
        </>
      ) : (
        <>
          <div className={`ygo-field${shakeKey ? " is-shaking" : ""}`} onAnimationEnd={() => setShakeKey(0)}>
            <div className="ygo-mat foe">
              {renderLp("b", "Đối thủ")}
              <div className="ygo-mat-main">
                <div className="ygo-mat-zones">
                  {renderStRow()}
                  {renderMonsters("b")}
                </div>
                {renderPiles("b")}
              </div>
            </div>
            <div className="ygo-divider">
              <span className="ygo-turn-chip">Lượt {turn}</span>
              <div className="poke-log" aria-live="polite">
                {finished ? <strong>{outcome.win ? "Thắng trận!" : "Thua trận"}</strong> : log || "Trận đấu bắt đầu!"}
              </div>
            </div>
            <div className="ygo-mat me">
              <div className="ygo-mat-main">
                <div className="ygo-mat-zones">
                  {renderMonsters("a")}
                  {renderStRow()}
                </div>
                {renderPiles("a")}
              </div>
              {renderLp("a", "Bạn")}
            </div>
          </div>
          {!finished ? (
            <div className="poke-controls">
              <button type="button" className="btn-ghost" onClick={() => setPlaying(!playing)}>
                {playing ? "Tạm dừng" : "Tiếp tục"}
              </button>
              <span className="poke-speed">
                {[1, 2, 4].map((s) => (
                  <button key={s} type="button" className={speed === s ? "on" : ""} onClick={() => setSpeed(s)}>
                    {s}×
                  </button>
                ))}
              </span>
              <button type="button" className="btn-ghost" onClick={skip}>Bỏ qua »</button>
            </div>
          ) : (
            <div className="poke-result">
              <p>
                LP cuối: Bạn {Math.max(0, lp[0]).toLocaleString("en-US")} – Đối thủ {Math.max(0, lp[1]).toLocaleString("en-US")} · {outcome.turns} lượt · +{outcome.coins.toLocaleString("en-US")} Coins · +{outcome.xp} XP cho cả đội
                {outcome.leveledUp.length ? ` · Lên cấp: ${outcome.leveledUp.join(", ")}` : ""}
              </p>
              <button type="button" className="btn-primary" disabled={busy} onClick={fight}>
                {busy ? "Đang xếp trận..." : "Đấu tiếp"}
              </button>
            </div>
          )}
        </>
      )}
      {error ? <p className="poke-error">{error}</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CardArt from "@/components/card-art";
import type { DigCardView, DigimonOutcome } from "@/lib/digimon";
import type { DigEvent } from "@/lib/digimon-battle";

/**
 * Digimon arena (spec 6.39i): replays the engine's event stream on a
 * simulator-style field — Security stack + Deck + Trash column,
 * Battle Area in the middle, Breeding Area on the side, and the
 * shared MEMORY GAUGE strip between the two halves. Real cards only:
 * attackers lift and lunge, hit cards shake, face-down stacks wear
 * the Puni card back with the Digimon logo. The result is already
 * settled server-side.
 */

interface MonState {
  name: string;
  suspended: boolean;
  dying?: boolean;
}
interface SideState {
  field: MonState[];
  breeding: string | null;
  security: number;
  hand: number;
  deckLeft: number;
  trash: number;
}

const emptySide = (deckSize: number): SideState => ({
  field: [],
  breeding: null,
  security: 5,
  hand: 5,
  deckLeft: Math.max(0, deckSize - 10),
  trash: 0,
});
const other = (s: "a" | "b"): "a" | "b" => (s === "a" ? "b" : "a");

const DELAYS: Record<string, number> = {
  attack: 860, block: 700, security: 860, delete: 700,
  digivolve: 640, play: 640, move: 560, hatch: 520,
};

export default function DigimonArena({
  previewDeck,
  ready,
  count,
}: {
  previewDeck: DigCardView[];
  ready: boolean;
  count: number;
}) {
  const [outcome, setOutcome] = useState<DigimonOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sides, setSides] = useState<{ a: SideState; b: SideState }>({
    a: emptySide(30), b: emptySide(30),
  });
  const [gauge, setGauge] = useState(0);
  const [activeSide, setActiveSide] = useState<"a" | "b">("a");
  const [log, setLog] = useState("Bấm Vào trận để bắt đầu.");
  const [hitKey, setHitKey] = useState(0);
  const [lunge, setLunge] = useState<{ key: number; side: "a" | "b"; name: string } | null>(null);
  const [hit, setHit] = useState<{ key: number; side: "a" | "b"; name: string } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [finished, setFinished] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const viewOf = useMemo(() => {
    const map = new Map<string, DigCardView>();
    const src = outcome
      ? [...outcome.deckA, ...outcome.deckB, ...(outcome.eggA ? [outcome.eggA] : []), ...(outcome.eggB ? [outcome.eggB] : [])]
      : previewDeck;
    for (const c of src) if (!map.has(c.name)) map.set(c.name, c);
    return (name: string) => map.get(name);
  }, [outcome, previewDeck]);

  const applyEvent = (e: DigEvent) => {
    setGauge(e.memory);
    setLog(e.text);
    if (e.type === "unsuspend") setActiveSide(e.side);
    if (e.type === "attack" && e.name) {
      setHitKey((k) => k + 1);
      setLunge({ key: hitKey + 1, side: e.side, name: e.name });
      if (e.targetName) setShakeKey((k) => k + 1);
    }
    if (e.type === "delete" && e.name) {
      setHit({ key: hitKey + 1, side: e.side, name: e.name });
    }
    setSides((prev) => {
      const next: { a: SideState; b: SideState } = {
        a: { ...prev.a, field: prev.a.field.filter((c) => !c.dying).map((c) => ({ ...c })) },
        b: { ...prev.b, field: prev.b.field.filter((c) => !c.dying).map((c) => ({ ...c })) },
      };
      const me = next[e.side];
      const foe = next[other(e.side)];
      // Security counts always come from the event snapshots.
      next.a.security = e.securityA;
      next.b.security = e.securityB;
      switch (e.type) {
        case "unsuspend":
          for (const c of me.field) c.suspended = false;
          break;
        case "draw":
          me.hand += 1;
          me.deckLeft = Math.max(0, me.deckLeft - 1);
          break;
        case "hatch":
          if (e.name) {
            me.breeding = e.name;
            me.deckLeft = Math.max(0, me.deckLeft - 1);
          }
          break;
        case "move":
          if (me.breeding) {
            me.field.push({ name: me.breeding, suspended: false });
            me.breeding = null;
          }
          break;
        case "play":
          me.hand = Math.max(0, me.hand - 1);
          if (e.name) me.field.push({ name: e.name, suspended: false });
          break;
        case "digivolve":
          me.deckLeft = Math.max(0, me.deckLeft - 1); // the digivolution draw
          if (e.targetName) {
            const mon = me.field.find((c) => c.name === e.targetName);
            if (mon && e.name) mon.name = e.name;
          } else if (e.name) {
            me.breeding = e.name;
          }
          break;
        case "attack": {
          const mon = me.field.find((c) => c.name === e.name && !c.suspended);
          if (mon) mon.suspended = true;
          break;
        }
        case "block": {
          const mon = foe.field.find((c) => c.name === e.name);
          if (mon) mon.suspended = true;
          break;
        }
        case "delete": {
          const mon = me.field.find((c) => c.name === e.name);
          if (mon) {
            mon.dying = true;
            me.trash += 1;
          }
          break;
        }
        default:
          break;
      }
      return next;
    });
  };

  useEffect(() => {
    if (!playing || !outcome) return;
    if (idx >= outcome.events.length) {
      setPlaying(false);
      setFinished(true);
      return;
    }
    const e = outcome.events[idx]!;
    const delay = (DELAYS[e.type] ?? 480) / speed;
    timer.current = setTimeout(() => {
      applyEvent(e);
      setIdx((i) => i + 1);
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, idx, outcome, speed]);

  const startReplay = (out: DigimonOutcome) => {
    setSides({ a: emptySide(out.deckA.length), b: emptySide(out.deckB.length) });
    setGauge(0);
    setActiveSide("a");
    setIdx(0);
    setFinished(false);
    setLunge(null);
    setHit(null);
    setLog("Trận đấu bắt đầu!");
    setPlaying(true);
  };

  const fight = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/me/digimon-battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fight" }),
      });
      const data = (await res.json()) as DigimonOutcome | { error: string };
      if (!res.ok || !("ok" in data)) {
        setError("error" in data ? data.error : "Có lỗi, thử lại sau.");
        return;
      }
      setOutcome(data);
      startReplay(data);
    } catch {
      setError("Có lỗi, thử lại sau.");
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    if (!outcome) return;
    for (let i = idx; i < outcome.events.length; i++) applyEvent(outcome.events[i]!);
    setIdx(outcome.events.length);
    setPlaying(false);
    setFinished(true);
  };

  const renderMon = (sideKey: "a" | "b", mon: MonState, i: number) => {
    const v = viewOf(mon.name);
    const isLunge = lunge?.side === sideKey && lunge?.name === mon.name && !finished;
    const isHit = hit?.side === sideKey && hit?.name === mon.name && !finished;
    return (
      <div
        key={`${mon.name}-${i}-${isLunge || isHit ? hitKey : 0}`}
        className={`dig-mon${mon.suspended ? " is-suspended" : ""}${mon.dying ? " is-dying" : ""}${isHit ? " is-hit" : ""}${isLunge ? ` lunge-${sideKey}` : ""}`}
        title={mon.name}
      >
        <CardArt src={v?.spriteUrl ?? ""} alt={mon.name} className="dig-mon-art" />
        <div className="dig-mon-chips">
          <span className="dig-dp">{(v?.dp ?? 0).toLocaleString("en-US")} DP</span>
          <span className="dig-lv">Lv.{v?.level ?? "?"}</span>
        </div>
      </div>
    );
  };

  const renderSide = (sideKey: "a" | "b", label: string) => {
    const side = sides[sideKey];
    const bv = side.breeding ? viewOf(side.breeding) : undefined;
    return (
      <div className={`dig-half ${sideKey === "b" ? "foe" : "me"}`}>
        <div className="dig-leftcol">
          <div className="dig-security" title="Security — chồng lá úp bảo vệ người chơi">
            <div className="dig-security-stack" aria-hidden>
              {Array.from({ length: Math.min(side.security, 5) }, (_, i) => (
                <span key={i} className="dig-security-card" style={{ transform: `translate(${i * 3}px, ${-i * 2}px)` }} />
              ))}
            </div>
            <small>Security {side.security}</small>
          </div>
          <div className="dig-pile deck" title="Main Deck">
            <strong>{side.deckLeft}</strong>
            <small>Deck</small>
          </div>
          <div className="dig-pile trash" title="Trash">
            <strong>{side.trash}</strong>
            <small>Trash</small>
          </div>
        </div>
        <div className="dig-fieldrow">
          {[0, 1, 2, 3, 4].map((slot) => {
            const mon = side.field[slot];
            return mon ? renderMon(sideKey, mon, slot) : <div key={slot} className="dig-mon empty" />;
          })}
        </div>
        <div className="dig-rightcol">
          <div className={`dig-breeding${side.breeding ? " filled" : ""}`} title="Breeding Area — nuôi Digimon rồi đưa ra sân khi đủ cấp">
            {side.breeding ? (
              <>
                <CardArt src={bv?.spriteUrl ?? ""} alt={side.breeding} className="dig-breeding-art" />
                <small>{(bv?.dp ?? 0).toLocaleString("en-US")} DP · Lv.{bv?.level ?? "?"}</small>
              </>
            ) : (
              <small>Breeding</small>
            )}
          </div>
          <div className="dig-pile hand" title="Bài trên tay">
            <strong>{side.hand}</strong>
            <small>Tay</small>
          </div>
        </div>
        <span className="dig-side-label">{label}</span>
      </div>
    );
  };

  return (
    <div className="poke-wrap arena-bleed">
      {!outcome ? (
        <>
          <p className="ygo-deckline">
            Bộ bài {count} lá Digimon · Memory Gauge dùng chung, Security 5 lá, có khu Breeding.
          </p>
          <div className="poke-team-preview">
            {previewDeck.slice(0, 5).map((c, i) => (
              <div key={i} className="poke-bench-card big">
                <CardArt src={c.spriteUrl} alt={c.name} className="poke-bench-art" />
                <small>{c.name}</small>
                <small>{c.dp.toLocaleString("en-US")} DP · Lv.{c.level} · Cost {c.cost}</small>
              </div>
            ))}
          </div>
          {!ready ? (
            <p className="poke-hint">Cần ít nhất 20 lá Digimon có DP thật để đấu — mở thêm gói Digimon ở trang Mở Thẻ nhé.</p>
          ) : null}
          <button type="button" className="btn-primary poke-fight-btn" disabled={!ready || busy} onClick={fight}>
            {busy ? "Đang xếp trận..." : "Vào trận"}
          </button>
        </>
      ) : (
        <>
          <div className={`dig-stage${shakeKey ? " is-shaking" : ""}`} onAnimationEnd={() => setShakeKey(0)}>
            {renderSide("b", "Đối thủ")}
            <div className="dig-gauge" title="Memory Gauge — qua số 0 về phía đối thủ là đổi lượt">
              <span className="dig-gauge-end foe">-10</span>
              <div className="dig-gauge-track">
                <span className="dig-gauge-zero" />
                <span
                  className={`dig-gauge-marker ${activeSide === "a" ? "mine" : "foes"}`}
                  style={{ left: `${((gauge + 10) / 20) * 100}%` }}
                />
              </div>
              <span className="dig-gauge-end me">+10</span>
              <span className="dig-gauge-label">
                Memory {gauge > 0 ? `+${gauge}` : gauge} · Lượt: {activeSide === "a" ? "Bạn" : "Đối thủ"}
              </span>
            </div>
            <div className="dig-log">{log}</div>
            {renderSide("a", "Đội của bạn")}
          </div>
          <div className="poke-controls">
            {!finished ? (
              <>
                <button type="button" className="btn-ghost" onClick={() => setPlaying((p) => !p)}>
                  {playing ? "Tạm dừng" : "Tiếp tục"}
                </button>
                {[1, 2, 4].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`btn-ghost${speed === s ? " is-active" : ""}`}
                    onClick={() => setSpeed(s)}
                  >
                    {s}×
                  </button>
                ))}
                <button type="button" className="btn-ghost" onClick={skip}>
                  Bỏ qua »
                </button>
              </>
            ) : null}
          </div>
          {finished ? (
            <div className="poke-result">
              <p>
                {outcome.win ? "Thắng trận!" : "Thua trận."} · Security cuối: Bạn {outcome.security[0]} – Đối thủ {outcome.security[1]} ·{" "}
                {outcome.turns} lượt · +{outcome.coins} Coins · +{outcome.xp} XP cho cả đội
                {outcome.leveledUp.length ? ` · Lên cấp: ${outcome.leveledUp.join(", ")}` : ""}
              </p>
              <button type="button" className="btn-primary" disabled={busy} onClick={fight}>
                {busy ? "Đang xếp trận..." : "Đấu tiếp"}
              </button>
            </div>
          ) : null}
        </>
      )}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

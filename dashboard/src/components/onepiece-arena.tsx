"use client";

import { useEffect, useRef, useState } from "react";
import CardArt from "@/components/card-art";
import HoloArt from "@/components/holo-art";
import type { OnePieceOutcome, OpCardView, OpLeaderView } from "@/lib/onepiece";
import type { OpEvent } from "@/lib/onepiece-battle";

interface CharState {
  name: string;
  rested: boolean;
  don: number;
  dying?: boolean;
}
interface SideState {
  chars: CharState[];
  leaderRested: boolean;
  leaderDon: number;
  donTotal: number;
}

const emptySide = (): SideState => ({ chars: [], leaderRested: false, leaderDon: 0, donTotal: 0 });
const foeOf = (s: "a" | "b"): "a" | "b" => (s === "a" ? "b" : "a");

/**
 * One Piece arena (spec 6.39): replays the real-rules battle —
 * Leader with Life pips, DON!! counter, Characters that rest when
 * they attack or block (shown sideways), KO's clearing the field.
 * The result is already settled server-side.
 */
export default function OnePieceArena({
  previewDeck,
  previewLeader,
  ready,
  count,
}: {
  previewDeck: OpCardView[];
  previewLeader: OpLeaderView;
  ready: boolean;
  count: number;
}) {
  const [outcome, setOutcome] = useState<OnePieceOutcome | null>(null);
  const [sides, setSides] = useState<{ a: SideState; b: SideState } | null>(null);
  const [life, setLife] = useState<[number, number]>([5, 5]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [log, setLog] = useState("");
  const [hit, setHit] = useState<{ key: number; side: "a" | "b"; name: string } | null>(null);
  const [lunge, setLunge] = useState<{ key: number; side: "a" | "b"; name: string } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [trash, setTrash] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
  const lastSide = useRef<"a" | "b" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const events = outcome?.events ?? [];
  const finished = outcome !== null && idx >= events.length;
  const viewOf = (side: "a" | "b", name: string): OpCardView | undefined =>
    (side === "a" ? outcome?.deckA : outcome?.deckB)?.find((c) => c.name === name);
  const leaderOf = (side: "a" | "b"): OpLeaderView | undefined =>
    side === "a" ? outcome?.leaderA : outcome?.leaderB;

  const applyEvent = (e: OpEvent, key: number, animate: boolean) => {
    setSides((prev) => {
      if (!prev) return prev;
      const next: { a: SideState; b: SideState } = {
        a: { ...prev.a, chars: prev.a.chars.filter((c) => !c.dying).map((c) => ({ ...c })) },
        b: { ...prev.b, chars: prev.b.chars.filter((c) => !c.dying).map((c) => ({ ...c })) },
      };
      // Refresh Phase: when the acting side changes, the new side's
      // rested cards stand and attached DON!! return.
      if (lastSide.current && lastSide.current !== e.side && e.type !== "win") {
        const fresh = next[e.side];
        for (const c of fresh.chars) { c.rested = false; c.don = 0; }
        fresh.leaderRested = false;
        fresh.leaderDon = 0;
      }
      lastSide.current = e.side;
      const mine = next[e.side];
      const foe = next[foeOf(e.side)];
      switch (e.type) {
        case "don":
          mine.donTotal = e.amount ?? mine.donTotal;
          break;
        case "play":
          mine.chars.push({ name: e.card ?? "", rested: false, don: 0 });
          break;
        case "attach":
          if (e.card === leaderOf(e.side)?.name) mine.leaderDon += e.amount ?? 0;
          else {
            const c = mine.chars.find((x) => x.name === e.card);
            if (c) c.don += e.amount ?? 0;
          }
          break;
        case "attack":
          if (e.card === leaderOf(e.side)?.name) mine.leaderRested = true;
          else {
            const c = mine.chars.find((x) => x.name === e.card);
            if (c) c.rested = true;
          }
          break;
        case "block": {
          const c = mine.chars.find((x) => x.name === e.card);
          if (c) c.rested = true;
          break;
        }
        case "ko": {
          const c = mine.chars.find((x) => x.name === e.card && !x.dying);
          if (c) c.dying = true;
          break;
        }
        default:
          break;
      }
      return next;
    });
    setLife([e.lifeA, e.lifeB]);
    setLog(e.text);
    if (e.type === "ko") setTrash((p) => ({ ...p, [e.side]: p[e.side] + 1 }));
    if (animate) {
      if (e.type === "attack" && e.card) {
        setLunge({ key, side: e.side, name: e.card });
        if (e.target) setHit({ key, side: foeOf(e.side), name: e.target });
      } else if (e.type === "block" && e.card) {
        setHit({ key, side: e.side, name: e.card });
      }
    }
  };

  useEffect(() => {
    if (!playing || finished || !outcome) return;
    const e = events[idx];
    if (!e) return;
    const base = e.type === "attack" || e.type === "ko" || e.type === "play" ? 700 : 380;
    timer.current = setTimeout(() => {
      applyEvent(e, idx, true);
      if (e.type === "ko" || e.type === "life") setShakeKey(idx + 1);
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
  };

  const fight = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/me/onepiece-battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fight" }),
      });
      const data = (await res.json()) as OnePieceOutcome | { error: string };
      if (!res.ok || !("ok" in data)) {
        setError(("error" in data && data.error) || "Có lỗi, thử lại sau.");
        return;
      }
      setOutcome(data);
      setSides({ a: emptySide(), b: emptySide() });
      setTrash({ a: 0, b: 0 });
      setLife([data.leaderA.life, data.leaderB.life]);
      setIdx(0);
      setHit(null);
      setLunge(null);
      lastSide.current = null;
      setLog("Trận đấu bắt đầu!");
      setPlaying(true);
    } catch {
      setError("Có lỗi, thử lại sau.");
    } finally {
      setBusy(false);
    }
  };

  const renderSide = (sideKey: "a" | "b", label: string) => {
    if (!sides || !outcome) return null;
    const side = sides[sideKey];
    const leader = leaderOf(sideKey)!;
    const lifeN = life[sideKey === "a" ? 0 : 1];
    const leaderHit = hit?.side === sideKey && hit?.name === leader.name && !finished;
    const leaderLunge = lunge?.side === sideKey && lunge?.name === leader.name && !finished;
    const attachedDon = side.leaderDon + side.chars.reduce((s, c) => s + c.don, 0);
    return (
      <div className="op-side">
        <div className="op-mat">
          <div className="op-leftcol">
            <div className="op-life-stack" title="Life — lá úp cạnh Leader như playmat chính thức">
              <div className="op-life-cards" aria-hidden>
                {Array.from({ length: Math.min(Math.max(lifeN, 0), 5) }, (_, i) => (
                  <span key={i} className="op-life-card" style={{ transform: `translateX(${i * 7}px) rotate(${(i - 2) * 4}deg)` }} />
                ))}
              </div>
              <small>Life {lifeN}</small>
            </div>
            <div className="op-don-area" title="Khu DON!! — vàng là DON đang gắn, viền là DON sẵn sàng">
              <div className="op-don-pips" aria-hidden>
                {Array.from({ length: side.donTotal }, (_, i) => (
                  <span key={i} className={`op-don-pip${i < attachedDon ? " attached" : ""}`} />
                ))}
              </div>
              <small>DON!! ×{side.donTotal}{attachedDon ? ` · gắn ${attachedDon}` : ""}</small>
            </div>
          </div>
          <div className="op-centercol">
            <div className="holo-center">
              <HoloArt
                src={leader.spriteUrl}
                side={sideKey}
                variant="crop"
                size="leader"
                attacking={leaderLunge}
                hit={leaderHit}
                dimmed={side.leaderRested}
                vfxColor="#ef4444"
                hitKey={leaderHit ? hit?.key : undefined}
              />
            </div>
            <div className="op-leader-row">
              <div
                className={`op-leader${side.leaderRested ? " is-rested" : ""}${leaderHit ? " is-hit" : ""}${leaderLunge ? ` lunge-${sideKey}` : ""}`}
              >
                <CardArt src={leader.spriteUrl} alt={leader.name} className="op-leader-art" />
                <div className="op-leader-info">
                  <strong>{leader.name}</strong>
                  <small>Leader · Power {leader.power.toLocaleString("en-US")}{side.leaderDon ? ` +${side.leaderDon * 1000} DON` : ""}</small>
                </div>
              </div>
              <div className="op-stage-slot" aria-hidden>Stage</div>
            </div>
        <div className="holo-row">
          {[0, 1, 2, 3, 4].map((slot) => {
            const c = side.chars[slot];
            if (!c) return <div key={slot} />;
            const v = viewOf(sideKey, c.name);
            const cHit = hit?.side === sideKey && hit?.name === c.name && !finished;
            const cLunge = lunge?.side === sideKey && lunge?.name === c.name && !finished;
            return (
              <HoloArt
                key={slot}
                src={v?.spriteUrl ?? ""}
                side={sideKey}
                variant="crop"
                size="portrait"
                attacking={cLunge}
                hit={cHit}
                dying={!!c.dying}
                dimmed={c.rested}
                vfxColor="#f59e0b"
                hitKey={cHit ? hit?.key : undefined}
              />
            );
          })}
        </div>
        <div className="ygo-zones">
          {[0, 1, 2, 3, 4].map((slot) => {
            const c = side.chars[slot];
            if (!c) return <div key={slot} className="ygo-zone empty" />;
            const v = viewOf(sideKey, c.name);
            const isHit = hit?.side === sideKey && hit?.name === c.name && !finished;
            const isLunge = lunge?.side === sideKey && lunge?.name === c.name && !finished;
            return (
              <div
                key={slot}
                className={`ygo-zone filled${c.rested ? " is-rested" : ""}${c.dying ? " is-dying" : ""}${isHit ? " is-hit" : ""}${isLunge ? ` lunge-${sideKey}` : ""}`}
                title={c.name}
              >
                <CardArt src={v?.spriteUrl ?? ""} alt={c.name} className="ygo-mon-art" />
                <div className="ygo-mon-info">
                  <strong>{c.name}</strong>
                  <small>
                    Power {(v?.power ?? 0) + c.don * 1000}
                    {c.don ? ` (+${c.don} DON)` : ""}
                  </small>
                  <span className="ygo-pos">{c.rested ? "Đã nghỉ" : "Sẵn sàng"}</span>
                </div>
              </div>
            );
          })}
          </div>
          </div>
          <div className="op-rightcol">
            <div className="ygo-pile deck" title="DON!! Deck — còn lại trong chồng DON">
              <span>{Math.max(0, 10 - side.donTotal)}</span>
              <small>DON Deck</small>
            </div>
            <div className="ygo-pile hand" title="Trash — Character đã bị K.O.">
              <span>{trash[sideKey]}</span>
              <small>Trash</small>
            </div>
          </div>
        </div>
        <span className="op-side-label">{label}</span>
      </div>
    );
  };

  return (
    <div className="poke-wrap">
      {!outcome ? (
        <>
          <p className="ygo-deckline">
            Leader của bạn: {previewLeader.name} (Power {previewLeader.power.toLocaleString("en-US")} · Life {previewLeader.life}) · Bộ bài {count} lá Character.
          </p>
          <div className="poke-team-preview">
            {previewDeck.slice(0, 5).map((c, i) => (
              <div key={i} className="poke-bench-card big">
                <CardArt src={c.spriteUrl} alt={c.name} className="poke-bench-art" />
                <small>{c.name}</small>
                <small>Power {c.power.toLocaleString("en-US")} · Cost {c.cost}</small>
              </div>
            ))}
          </div>
          {!ready ? (
            <p className="poke-hint">Cần ít nhất 10 lá Character One Piece có Power thật để đấu — mở thêm gói One Piece ở trang Mở Thẻ nhé.</p>
          ) : null}
          <button type="button" className="btn-primary poke-fight-btn" disabled={!ready || busy} onClick={fight}>
            {busy ? "Đang xếp trận..." : "Ra khơi!"}
          </button>
        </>
      ) : (
        <>
          <div className={`ygo-field op-field${shakeKey ? " is-shaking" : ""}`} onAnimationEnd={() => setShakeKey(0)}>
            {renderSide("b", "Đối thủ")}
            <div className="poke-log" aria-live="polite">
              {finished ? <strong>{outcome.win ? "Thắng trận!" : "Thua trận"}</strong> : log || "Trận đấu bắt đầu!"}
            </div>
            {renderSide("a", "Đội của bạn")}
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
                Life cuối: Bạn {life[0]} – Đối thủ {life[1]} · {outcome.turns} lượt · +{outcome.coins.toLocaleString("en-US")} Coins · +{outcome.xp} XP cho cả đội
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

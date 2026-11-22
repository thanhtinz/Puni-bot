"use client";

/**
 * Dragon Ball Fusion World arena (spec 6.39): a full-field stage on
 * the generated arena background — Life stacks and the Leader on the
 * left of each half, the Battle Area in the middle, an Energy strip
 * under it (orbs: lit = available, dim = rested), Deck and hand
 * counts on the right. Replays the engine's event stream: hologram
 * projections of the Leader and Battle Cards, attack lunges, VFX
 * bursts coloured by the attacker, KO fades and Life losses.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { DbCardView, DbLeaderView, DragonBallOutcome } from "@/lib/dragonball";
import type { DbEvent } from "@/lib/dragonball-battle";
import CardArt from "@/components/card-art";

interface FieldChar {
  name: string;
  rested: boolean;
  dying?: boolean;
}
interface SideState {
  leaderRested: boolean;
  awakened: boolean;
  field: FieldChar[];
  hand: number;
  deckLeft: number;
}
const emptySide = (deckSize: number): SideState => ({
  leaderRested: false, awakened: false, field: [], hand: 6,
  deckLeft: Math.max(0, deckSize - 14),
});
const other = (s: "a" | "b"): "a" | "b" => (s === "a" ? "b" : "a");

export default function DragonBallArena({
  previewDeck, previewLeader, ready, count,
}: {
  previewDeck: DbCardView[];
  previewLeader: DbLeaderView;
  ready: boolean;
  count: number;
}) {
  const [outcome, setOutcome] = useState<DragonBallOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sides, setSides] = useState<{ a: SideState; b: SideState }>({
    a: emptySide(30), b: emptySide(30),
  });
  const [life, setLife] = useState<[number, number]>([8, 8]);
  const [energy, setEnergy] = useState<{ a: [number, number]; b: [number, number] }>({
    a: [0, 0], b: [0, 0],
  });
  const [log, setLog] = useState("Bấm Bắt đầu đấu để vào trận.");
  const [hitKey, setHitKey] = useState(0);
  const [lunge, setLunge] = useState<{ side: "a" | "b"; name: string } | null>(null);
  const [hit, setHit] = useState<{ side: "a" | "b"; name: string } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [finished, setFinished] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSide = useRef<"a" | "b" | null>(null);

  const viewOf = useMemo(() => {
    const map = new Map<string, DbCardView>();
    if (outcome) {
      for (const c of [...outcome.deckA, ...outcome.deckB]) map.set(c.name, c);
    } else {
      for (const c of previewDeck) map.set(c.name, c);
    }
    return map;
  }, [outcome, previewDeck]);
  const leaderOf = (side: "a" | "b"): DbLeaderView =>
    outcome ? (side === "a" ? outcome.leaderA : outcome.leaderB) : previewLeader;

  const applyEvent = (e: DbEvent) => {
    setSides((prev) => {
      const next: { a: SideState; b: SideState } = {
        a: { ...prev.a, field: prev.a.field.filter((c) => !c.dying).map((c) => ({ ...c })) },
        b: { ...prev.b, field: prev.b.field.filter((c) => !c.dying).map((c) => ({ ...c })) },
      };
      // A new acting side means its Charge Phase just happened:
      // everything on that side switches back to Active Mode.
      if (lastSide.current !== e.side) {
        const s = next[e.side];
        s.leaderRested = false;
        for (const c of s.field) c.rested = false;
        lastSide.current = e.side;
      }
      const me = next[e.side];
      const foe = next[other(e.side)];
      switch (e.type) {
        case "draw":
          me.hand += 1;
          me.deckLeft = Math.max(0, me.deckLeft - 1);
          break;
        case "energy":
          me.hand = Math.max(0, me.hand - 1);
          break;
        case "play":
          me.hand = Math.max(0, me.hand - 1);
          if (e.card) me.field.push({ name: e.card, rested: false });
          break;
        case "combo":
          me.hand = Math.max(0, me.hand - 1);
          break;
        case "awaken":
          me.awakened = true;
          break;
        case "attack": {
          if (e.card === leaderOf(e.side).name) me.leaderRested = true;
          else {
            const c = me.field.find((x) => x.name === e.card && !x.rested);
            if (c) c.rested = true;
          }
          break;
        }
        case "ko": {
          const c = foe.field.find((x) => x.name === e.target);
          if (c) c.dying = true;
          break;
        }
        case "life":
          if (!e.text.includes("Critical")) foe.hand += 1;
          break;
        default:
          break;
      }
      return next;
    });
    setLife([e.lifeA, e.lifeB]);
    setEnergy({ a: [e.energyA, e.energyMaxA], b: [e.energyB, e.energyMaxB] });
    setLog(e.text);
    if (e.type === "attack") {
      setLunge({ side: e.side, name: e.card ?? "" });
      setHit({ side: other(e.side), name: e.target ?? "" });
      setHitKey((k) => k + 1);
    } else {
      setLunge(null);
      setHit(null);
    }
    if (e.type === "ko" || e.type === "life") setShakeKey((k) => k + 1);
  };

  useEffect(() => {
    if (!playing || !outcome) return;
    if (idx >= outcome.events.length) {
      setPlaying(false);
      setFinished(true);
      return;
    }
    const e = outcome.events[idx]!;
    const delay = (e.type === "attack" || e.type === "ko" ? 780 : 430) / speed;
    timer.current = setTimeout(() => {
      applyEvent(e);
      setIdx((i) => i + 1);
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, idx, outcome, speed]);

  const fight = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/me/dragonball-battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fight" }),
      });
      const data = (await res.json()) as DragonBallOutcome | { error: string };
      if (!res.ok || !("ok" in data)) {
        setError(("error" in data && data.error) || "Không đấu được.");
        return;
      }
      setOutcome(data);
      setSides({ a: emptySide(data.deckA.length), b: emptySide(data.deckB.length) });
      setLife([8, 8]);
      setEnergy({ a: [0, 0], b: [0, 0] });
      lastSide.current = null;
      setIdx(0);
      setFinished(false);
      setLunge(null);
      setHit(null);
      setLog("Trận đấu bắt đầu!");
      setPlaying(true);
    } catch {
      setError("Không kết nối được máy chủ.");
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

  const renderEnergy = (side: "a" | "b") => {
    const [avail, max] = energy[side];
    return (
      <div className="db-energy" aria-label={`Energy ${avail}/${max}`}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={`db-energy-orb${i < avail ? "" : " spent"}`} />
        ))}
        <small>Energy {avail}/{max}</small>
      </div>
    );
  };

  const renderSide = (side: "a" | "b") => {
    const st = sides[side];
    const leader = leaderOf(side);
    const leaderPower = st.awakened ? leader.powerAwake : leader.power;
    return (
      <div className={`db-half ${side === "a" ? "me" : "foe"}`}>
        <div className="db-leftcol">
          <div className="op-life-stack">
            <div className="op-life-cards" aria-hidden="true">
              {Array.from({ length: Math.max(0, life[side === "a" ? 0 : 1]) }, (_, i) => (
                <span key={i} className="op-life-card" style={{ transform: `translateX(${i * 5}px)` }} />
              ))}
            </div>
            <small>Life {life[side === "a" ? 0 : 1]}</small>
          </div>
          <div className="db-leader">
            <div key={`leader-${side}-${lunge?.name === leader.name || hit?.name === leader.name ? hitKey : 0}`} className={`db-leader-card${st.leaderRested ? " rested" : ""}${lunge?.side === side && lunge?.name === leader.name ? ` lunge-${side}` : ""}${hit?.side === side && hit?.name === leader.name ? " is-hit" : ""}`}>
              <CardArt src={leader.spriteUrl} alt={leader.name} className="db-leader-art" />
              <div className="db-leader-info">
                <strong>{leader.name}</strong>
                <small>
                  Leader · Power {leaderPower.toLocaleString("en-US")}
                  {st.awakened ? " · AWAKEN" : ""}
                </small>
              </div>
            </div>
          </div>
        </div>
        <div className="db-centercol">
          <div className="db-field-row">
            {st.field.map((c, i) => {
              const v = viewOf.get(c.name);
              return (
                <div key={`${c.name}-${i}-${lunge?.name === c.name || hit?.name === c.name ? hitKey : 0}`} className={`db-zone filled${c.rested ? " rested" : ""}${c.dying ? " is-dying" : ""}${lunge?.side === side && lunge?.name === c.name ? ` lunge-${side}` : ""}${hit?.side === side && hit?.name === c.name ? " is-hit" : ""}`}>
                  <CardArt src={v?.spriteUrl ?? ""} alt={c.name} className="db-zone-art" />
                  <small>{c.name}</small>
                  <span className="db-zone-power">{(v?.power ?? 0).toLocaleString("en-US")}</span>
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, 5 - st.field.length) }, (_, i) => (
              <div key={`empty-${i}`} className="db-zone"><span className="ygo-zone-ring" /></div>
            ))}
          </div>
          {renderEnergy(side)}
        </div>
        <div className="db-rightcol">
          <div className="ygo-pile deck"><strong>{st.deckLeft}</strong><small>Deck</small></div>
          <div className="ygo-pile hand"><strong>{st.hand}</strong><small>Tay</small></div>
        </div>
        <span className="op-side-label">{side === "a" ? "Đội của bạn" : "Đối thủ"}</span>
      </div>
    );
  };

  return (
    <div className="battle-arena arena-bleed">
      {!ready && !outcome ? (
        <p className="form-note">
          Cần ít nhất 20 lá Battle Card Dragon Ball Fusion World có Power thật để đấu — bạn đang có {count}.
          Hãy mở thêm gói Dragon Ball ở mục Mở Thẻ.
        </p>
      ) : null}
      <div
        className={`db-stage${shakeKey ? " is-shaking" : ""}`}
        key={shakeKey}
        onAnimationEnd={() => setShakeKey(0)}
      >
        {renderSide("b")}
        <div className="poke-log pill">{log}</div>
        {renderSide("a")}
      </div>
      <div className="poke-controls">
        {!outcome || finished ? (
          <button type="button" className="btn-primary" onClick={fight} disabled={busy || !ready}>
            {busy ? "Đang tạo trận..." : outcome ? "Đấu trận mới" : "Bắt đầu đấu"}
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={() => setPlaying((p) => !p)}>
              {playing ? "Tạm dừng" : "Chạy tiếp"}
            </button>
            <div className="poke-speed" role="group" aria-label="Tốc độ">
              {[1, 2, 4].map((s) => (
                <button
                  key={s} type="button"
                  className={speed === s ? "active" : ""}
                  onClick={() => setSpeed(s)}
                >
                  {s}×
                </button>
              ))}
            </div>
            <button type="button" className="btn-ghost" onClick={skip}>Bỏ qua »</button>
          </>
        )}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {finished && outcome ? (
        <div className={`poke-result ${outcome.win ? "win" : "lose"}`}>
          <strong>{outcome.win ? "Thắng trận!" : "Thua trận"}</strong>
          <span>
            Life còn lại — bạn {outcome.life[0]} · đối thủ {outcome.life[1]} · {outcome.turns} lượt ·
            +{outcome.coins.toLocaleString("en-US")} Coins · +{outcome.xp} XP cho mỗi lá trong bộ
          </span>
          {outcome.leveledUp.length ? <span>{outcome.leveledUp.join(" · ")}</span> : null}
        </div>
      ) : null}
      {!outcome && previewDeck.length ? (
        <p className="form-note">
          Leader: {previewLeader.name} (Power {previewLeader.power.toLocaleString("en-US")} → Awaken{" "}
          {previewLeader.powerAwake.toLocaleString("en-US")}) · Bộ bài {count} lá Battle Card.
        </p>
      ) : null}
    </div>
  );
}

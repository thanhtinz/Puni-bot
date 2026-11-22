"use client";

import { useEffect, useRef, useState } from "react";
import CardArt from "@/components/card-art";
import { VfxBurst } from "@/components/holo-art";
import type { PokemonOutcome, PokeTeamCard } from "@/lib/pokemon";
import type { PokeEvent, PokeStatus } from "@/lib/pokemon-battle";

const STATUS_VI: Record<PokeStatus, string> = {
  asleep: "Đang ngủ",
  paralyzed: "Tê liệt",
  poisoned: "Trúng độc",
  burned: "Bỏng",
  confused: "Hoang mang",
};

interface AFighter {
  card: PokeTeamCard;
  hp: number;
  ko: boolean;
  energy: number;
  status: PokeStatus | null;
}
interface ASide {
  fighters: AFighter[];
  active: number;
}

const mkSide = (team: PokeTeamCard[]): ASide => ({
  fighters: team.map((card) => ({ card, hp: card.maxHp, ko: false, energy: 0, status: null })),
  active: 0,
});
const other = (s: "a" | "b"): "a" | "b" => (s === "a" ? "b" : "a");

function hpTone(hp: number, max: number): string {
  const k = max > 0 ? hp / max : 0;
  if (k > 0.5) return "hp-high";
  if (k > 0.22) return "hp-mid";
  return "hp-low";
}

/**
 * Hologram projection of the Active Pokémon: its animated sprite
 * hovers over a cone of light above the card like a 3D projection —
 * floating, flickering, with a floor reflection. It lunges when the
 * Pokémon attacks and flashes when it takes a hit. Species without a
 * mapped sprite simply show no projection.
 */
const TYPE_COLORS: Record<string, string> = {
  G: "#22c55e", W: "#3b82f6", R: "#f97316", L: "#eab308", P: "#a855f7",
  F: "#c2410c", D: "#7c3aed", M: "#94a3b8", Y: "#ec4899", N: "#f59e0b", C: "#fbbf24",
};

function HoloProj({
  card,
  side,
  attacking,
  hit,
  vfxColor,
  hitKey,
}: {
  card: PokeTeamCard;
  side: "a" | "b";
  attacking: boolean;
  hit: boolean;
  vfxColor?: string;
  hitKey?: number;
}) {
  const [err, setErr] = useState(false);
  useEffect(() => {
    setErr(false);
  }, [card.speciesId]);
  const src = card.slug && !err ? `/api/poke-sprite?slug=${card.slug}` : null;
  return (
    <div
      className={`holo-wrap${attacking ? " is-attacking" : ""}${hit ? " is-hit" : ""}`}
      data-side={side}
      aria-hidden
    >
      <div className="holo-cone" />
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="holo-img" src={src} alt="" onError={() => setErr(true)} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="holo-reflect" src={src} alt="" />
        </>
      ) : null}
      {hit && hitKey !== undefined ? <VfxBurst color={vfxColor} burstKey={hitKey} /> : null}
      <div className="holo-ring" />
    </div>
  );
}

/**
 * Pokémon arena (spec 6.39): replays the engine's event stream on a
 * proper TCG field — Active front and centre, Bench behind, Prize
 * pips on the side. Attackers lunge, damage numbers float, HP bars
 * drain, status badges appear, KO'd cards fall and the Bench
 * promotes. The result is already settled server-side.
 */
export default function PokemonArena({
  previewTeam,
  ready,
}: {
  previewTeam: PokeTeamCard[];
  ready: boolean;
}) {
  const [outcome, setOutcome] = useState<PokemonOutcome | null>(null);
  const [sides, setSides] = useState<{ a: ASide; b: ASide } | null>(null);
  const [prizes, setPrizes] = useState<[number, number]>([0, 0]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [float, setFloat] = useState<{ key: number; side: "a" | "b"; dmg: number; tag?: string } | null>(null);
  const [lunge, setLunge] = useState<{ key: number; side: "a" | "b" } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [log, setLog] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const events = outcome?.events ?? [];
  const finished = outcome !== null && idx >= events.length;

  const applyEvent = (e: PokeEvent, key: number, animate: boolean) => {
    setSides((prev) => {
      if (!prev) return prev;
      const next = {
        a: { fighters: prev.a.fighters.map((f) => ({ ...f })), active: prev.a.active },
        b: { fighters: prev.b.fighters.map((f) => ({ ...f })), active: prev.b.active },
      };
      const mine = next[e.side];
      const foe = next[other(e.side)];
      const myActive = mine.fighters[mine.active]!;
      const foeActive = foe.fighters[foe.active]!;
      switch (e.type) {
        case "energy":
          myActive.energy += 1;
          break;
        case "attack":
          if (e.defenderHp !== undefined) foeActive.hp = e.defenderHp;
          break;
        case "confusion-self":
        case "status-tick":
          if (e.defenderHp !== undefined) myActive.hp = e.defenderHp;
          break;
        case "status-inflicted":
          if (e.status) foeActive.status = e.status;
          break;
        case "wake":
        case "paralysis-miss":
          myActive.status = null;
          break;
        case "ko":
          foeActive.hp = 0;
          foeActive.ko = true;
          foeActive.status = null;
          break;
        case "promote": {
          const i = foe.fighters.findIndex((f) => !f.ko && f.card.name === e.defender);
          if (i >= 0) foe.active = i;
          break;
        }
        default:
          break;
      }
      return next;
    });
    if (e.prizes) setPrizes(e.prizes);
    setLog(e.text);
    if (animate) {
      if (e.type === "attack") {
        setLunge({ key, side: e.side });
        setFloat({
          key, side: other(e.side), dmg: e.damage ?? 0,
          tag: e.modifier === "weakness" ? "Điểm yếu ×2!" : e.modifier === "resistance" ? "Bị kháng" : undefined,
        });
        if ((e.damage ?? 0) >= 120) setShakeKey(key + 1);
      } else if (e.type === "confusion-self" || e.type === "status-tick") {
        setFloat({ key, side: e.side, dmg: e.damage ?? 0 });
      } else {
        setFloat(null);
      }
    }
  };

  useEffect(() => {
    if (!playing || finished || !outcome) return;
    const e = events[idx];
    if (!e) return;
    const base = e.type === "attack" || e.type === "ko" ? 750 : 420;
    timer.current = setTimeout(() => {
      applyEvent(e, idx, true);
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
    setFloat(null);
  };

  const fight = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/me/pokemon-battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fight" }),
      });
      const data = (await res.json()) as PokemonOutcome | { error: string };
      if (!res.ok || !("ok" in data)) {
        setError(("error" in data && data.error) || "Có lỗi, thử lại sau.");
        return;
      }
      setOutcome(data);
      setSides({ a: mkSide(data.teamA), b: mkSide(data.teamB) });
      setPrizes([0, 0]);
      setIdx(0);
      setFloat(null);
      setLunge(null);
      setLog("Trận đấu bắt đầu!");
      setPlaying(true);
    } catch {
      setError("Có lỗi, thử lại sau.");
    } finally {
      setBusy(false);
    }
  };

  const renderActive = (sideKey: "a" | "b") => {
    if (!sides) return null;
    const side = sides[sideKey];
    const f = side.fighters[side.active];
    if (!f) return null;
    const isLunging = lunge?.side === sideKey && !finished;
    const isHit = float?.side === sideKey && !finished;
    const foe = sides[other(sideKey)];
    const foeType = foe.fighters[foe.active]?.card.type ?? "C";
    return (
      <div key={`${sideKey}-${side.active}-${lunge?.key ?? 0}`} className="poke-active-stack">
        <HoloProj
          card={f.card}
          side={sideKey}
          attacking={isLunging}
          hit={isHit}
          vfxColor={TYPE_COLORS[foeType.charAt(0).toUpperCase()] ?? "#fbbf24"}
          hitKey={float?.key}
        />
        <div
          className={`poke-active${isLunging ? ` lunge-${sideKey}` : ""}${isHit ? " is-hit" : ""}${f.ko ? " is-ko" : ""}`}
        >
        <CardArt src={f.card.spriteUrl} alt={f.card.name} className="poke-active-art" />
        {isHit && float ? (
          <span className="poke-float" key={float.key}>
            -{float.dmg}
            {float.tag ? <em>{float.tag}</em> : null}
          </span>
        ) : null}
        <div className="poke-active-info">
          <strong>{f.card.name}</strong>
          <span className="poke-type">{f.card.type}</span>
          {f.status ? <span className="poke-status">{STATUS_VI[f.status]}</span> : null}
          <div className="poke-hpbar">
            <span className={hpTone(f.hp, f.card.maxHp)} style={{ width: `${Math.max(0, (f.hp / f.card.maxHp) * 100)}%` }} />
          </div>
          <small>{Math.max(0, f.hp)} / {f.card.maxHp} HP · Năng lượng: {f.energy}</small>
        </div>
        </div>
      </div>
    );
  };

  const renderBench = (sideKey: "a" | "b") => {
    if (!sides) return null;
    const side = sides[sideKey];
    return (
      <div className="poke-bench">
        {side.fighters.map((f, i) =>
          i === side.active ? null : (
            <div key={i} className={`poke-bench-card${f.ko ? " is-ko" : ""}`} title={f.card.name}>
              <CardArt src={f.card.spriteUrl} alt={f.card.name} className="poke-bench-art" />
              <small>{f.ko ? "KO" : `${Math.max(0, f.hp)}/${f.card.maxHp}`}</small>
            </div>
          ),
        )}
      </div>
    );
  };

  const renderPrizes = (n: number) => (
    <span className="poke-prizes" aria-label={`Đã lấy ${n} thẻ thưởng`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`poke-prize${i < n ? " won" : ""}`} />
      ))}
    </span>
  );

  return (
    <div className="poke-wrap">
      {!outcome ? (
        <>
          <div className="poke-team-preview">
            {previewTeam.map((c, i) => (
              <div key={i} className="poke-bench-card big">
                <CardArt src={c.spriteUrl} alt={c.name} className="poke-bench-art" />
                <small>{c.name}</small>
                <small>{c.maxHp} HP · {c.moves.slice(0, 2).join(" · ") || "—"}</small>
              </div>
            ))}
          </div>
          {!ready ? (
            <p className="poke-hint">
              Đội cần 5 lá Pokémon có chiêu thật — bạn đang có {previewTeam.length}/5. Mở thêm gói Pokémon ở trang Mở Thẻ nhé.
            </p>
          ) : null}
          <button type="button" className="btn-primary poke-fight-btn" disabled={!ready || busy} onClick={fight}>
            {busy ? "Đang xếp trận..." : "Vào trận"}
          </button>
        </>
      ) : (
        <>
          <div className={`poke-field${shakeKey ? " is-shaking" : ""}`} onAnimationEnd={() => setShakeKey(0)}>
            <div className="poke-side is-b">
              <div className="poke-side-head">
                <span>Đối thủ</span>
                {renderPrizes(prizes[1])}
              </div>
              {renderBench("b")}
              {renderActive("b")}
            </div>
            <div className="poke-log" aria-live="polite">
              {finished && outcome ? (
                <strong>{outcome.win ? "Thắng trận!" : "Thua trận"}</strong>
              ) : (
                log || "Trận đấu bắt đầu!"
              )}
            </div>
            <div className="poke-side is-a">
              {renderActive("a")}
              {renderBench("a")}
              <div className="poke-side-head">
                <span>Đội của bạn</span>
                {renderPrizes(prizes[0])}
              </div>
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
                Thẻ thưởng {prizes[0]}–{prizes[1]} · +{outcome.coins.toLocaleString("en-US")} Coins · +{outcome.xp} XP cho cả đội
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

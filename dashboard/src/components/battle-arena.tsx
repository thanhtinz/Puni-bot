"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import CardArt from "@/components/card-art";
import type { BattleCardInput, BattleEvent, BattleOutcome } from "@/lib/battle";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

interface Fighter extends BattleCardInput {
  hp: number;
  side: "a" | "b";
}

function hpTone(hp: number, max: number): string {
  const k = max > 0 ? hp / max : 0;
  if (k > 0.5) return "hp-high";
  if (k > 0.22) return "hp-mid";
  return "hp-low";
}

/**
 * Arena playback for a finished web battle (spec 6.24 visual pass,
 * modelled on TCG Pocket / Duel Links battle screens): the result
 * is already committed server-side; this replays the structured
 * event stream — attackers lunge, damage numbers float, HP bars
 * drain, KO'd cards fall — with pause / speed / skip controls and
 * the victory banner + rewards at the end.
 */
export default function BattleArena({
  outcome,
  againForm,
}: {
  outcome: BattleOutcome;
  againForm?: ReactNode;
}) {
  const events = outcome.events;
  const [hp, setHp] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const c of [...outcome.team, ...outcome.enemy]) m[c.code] = c.maxHp;
    return m;
  });
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);
  const [hit, setHit] = useState<{ key: number; att: string; target: string; dmg: number; special: boolean; round: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finished = idx >= events.length;
  const currentRound = useMemo(
    () => (events.length ? events[Math.min(idx, events.length - 1)].round : 0),
    [events, idx],
  );

  const applyEvent = (e: BattleEvent, key: number) => {
    setHp((prev) => ({ ...prev, [e.targetCode]: e.targetHp }));
    setHit({ key, att: e.attCode, target: e.targetCode, dmg: e.dmg, special: e.special, round: e.round });
  };

  useEffect(() => {
    if (!playing || finished) return;
    timer.current = setTimeout(() => {
      const e = events[idx];
      if (e) applyEvent(e, idx);
      setIdx(idx + 1);
    }, 320 / speed);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, idx, finished, events]);

  const skip = () => {
    const m: Record<string, number> = {};
    for (const c of [...outcome.team, ...outcome.enemy]) m[c.code] = c.maxHp;
    for (const e of events) m[e.targetCode] = e.targetHp;
    setHp(m);
    setIdx(events.length);
    setPlaying(false);
    setHit(null);
  };

  const renderTeam = (cards: BattleCardInput[], side: "a" | "b") => (
    <div className={`arena-row arena-row-${side}`}>
      {cards.map((c) => {
        const cur = hp[c.code] ?? c.maxHp;
        const ko = cur <= 0;
        const isAtt = hit && !finished && hit.att === c.code;
        const isHit = hit && !finished && hit.target === c.code;
        return (
          <div
            key={c.code}
            className={`arena-fighter ${ko ? "is-ko" : ""} ${isAtt ? "is-attacking" : ""} ${isHit ? "is-hit" : ""}`}
          >
            <div className="arena-fighter-art">
              <CardArt src={c.spriteUrl ?? ""} alt={c.name} rarity={c.rarity} />
              {isHit ? (
                <span key={hit.key} className={`arena-dmg ${hit.special ? "is-special" : ""}`}>
                  −{hit.dmg}
                </span>
              ) : null}
              {ko ? <span className="arena-ko">KO</span> : null}
            </div>
            <div className="arena-fighter-name">{c.name}</div>
            <div className="arena-hpbar">
              <span
                className={`arena-hpfill ${hpTone(cur, c.maxHp)}`}
                style={{ width: `${Math.max(0, Math.min(100, (cur / c.maxHp) * 100))}%` }}
              />
            </div>
            <div className="arena-hptext">
              <span>{cur}/{c.maxHp} HP</span>
              <span className="arena-atk">ATK {c.atk}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <section className="gacha-block arena-block">
      <div className="arena-stage">
        <div className="arena-side-label arena-side-enemy">ĐỘI ĐỊCH</div>
        {renderTeam(outcome.enemy, "b")}
        <div className="arena-midline">
          {!finished && hit ? (
            <span key={`r${hit.key}`} className="arena-round-chip">HIỆP {hit.round}</span>
          ) : (
            <span className="arena-round-chip is-idle">{finished ? "KẾT THÚC" : `HIỆP ${currentRound || 1}`}</span>
          )}
          <span className="arena-vs">VS</span>
        </div>
        {renderTeam(outcome.team, "a")}
        <div className="arena-side-label arena-side-you">ĐỘI CỦA BẠN</div>
        {finished ? (
          <div className={`arena-result ${outcome.win ? "is-win" : "is-lose"}`}>
            <div className="arena-result-title">{outcome.win ? "THẮNG!" : "THUA"}</div>
            <div className="arena-result-sub">
              {outcome.rounds} hiệp · +{fmt(outcome.coins)} Coins · +{outcome.xp} XP cho mỗi thẻ
              {outcome.leveledUp.length ? ` · Lên cấp: ${outcome.leveledUp.join(", ")}` : ""}
            </div>
          </div>
        ) : null}
      </div>
      <div className="arena-controls">
        {finished ? (
          againForm
        ) : (
          <>
            <button type="button" className="player-btn sm" onClick={() => setPlaying(!playing)}>
              {playing ? "Tạm dừng" : "Chạy tiếp"}
            </button>
            <button
              type="button"
              className="player-btn sm ghost"
              onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1)}
            >
              Tốc độ {speed}x
            </button>
            <button type="button" className="player-btn sm ghost" onClick={skip}>
              Bỏ qua tới kết quả
            </button>
            <span className="arena-progress">Đòn {Math.min(idx + 1, events.length)}/{events.length}</span>
          </>
        )}
      </div>
      <details className="arena-log">
        <summary>Nhật ký trận ({outcome.log.length} dòng cuối)</summary>
        <ol className="battle-log">
          {outcome.log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}

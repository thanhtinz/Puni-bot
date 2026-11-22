/**
 * Pokémon TCG engine (spec 6.39) — the first per-game battle engine.
 * Faithful-but-scoped v1 of the real TCG, played on a proper field:
 * 1 Active + up to 4 Benched per side (our 5-card teams).
 *
 * Real card data drives everything: printed HP, printed attacks with
 * energy costs ("2G" = 2 generic + 1 Grass), weakness (Rx2 / R+30),
 * resistance (W-30) and the common Special Conditions named in the
 * attack text (Asleep / Paralyzed / Poisoned / Burned / Confused).
 * Energy accrues automatically: at the start of a side's turn its
 * Active gains 1 Energy of its own type. The engine is deterministic
 * for a given seed and emits an event stream the arena replays with
 * attack animations — the engine never knows about presentation.
 */

export interface PokeMove {
  name: string;
  /** Energy cost string: digits = generic count, letters = typed
   *  energy (G R W L P F D M Y N), C = any type. */
  cost: string;
  damage: number;
  suffix?: string;
  effect?: string;
}

export interface PokeFighter {
  speciesId: string;
  name: string;
  /** Printed HP of the real card. */
  hp: number;
  /** The card's own type letter. */
  type: string;
  moves: PokeMove[];
  weakness?: string | null;
  resistance?: string | null;
  retreat?: number;
  level?: number;
  enhance?: number;
}

export type PokeStatus = "asleep" | "paralyzed" | "poisoned" | "burned" | "confused";

export interface PokeEvent {
  turn: number;
  side: "a" | "b";
  type:
    | "energy" | "attack" | "no-energy" | "ko" | "promote"
    | "status-inflicted" | "status-tick" | "wake" | "sleep-miss"
    | "paralysis-miss" | "confusion-self" | "win";
  move?: string;
  damage?: number;
  /** Damage modifier actually applied: "weakness" | "resistance" | null. */
  modifier?: "weakness" | "resistance" | null;
  status?: PokeStatus;
  attacker?: string;
  defender?: string;
  /** Defender HP after the event (for attack/tick events). */
  defenderHp?: number;
  prizes?: [number, number];
  text: string;
}

export interface PokeFighterState {
  speciesId: string;
  name: string;
  hp: number;
  maxHp: number;
  energy: string[];
  status: PokeStatus | null;
  ko: boolean;
}

export interface PokemonBattleResult {
  winner: "a" | "b";
  turns: number;
  prizes: [number, number];
  events: PokeEvent[];
  finalA: PokeFighterState[];
  finalB: PokeFighterState[];
}

const MAX_TURNS = 80;
export const PRIZES_TO_WIN = 3;

/* ---------------- seeded RNG (same family as tcg-formats) -------- */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
export function rngFromSeed(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- energy ------------------------------------------ */

/** Parse a cost string into typed requirements + generic count. */
export function parseCost(cost: string): { typed: string[]; generic: number; total: number } {
  const typed: string[] = [];
  let generic = 0;
  for (const ch of cost.toUpperCase()) {
    if (ch >= "0" && ch <= "9") generic += Number(ch);
    else if (ch === "C") generic += 1;
    else typed.push(ch);
  }
  return { typed, generic, total: typed.length + generic };
}

export function canPay(energy: string[], cost: string): boolean {
  const { typed, total } = parseCost(cost);
  if (energy.length < total) return false;
  const pool = [...energy];
  for (const t of typed) {
    const i = pool.indexOf(t);
    if (i === -1) return false;
    pool.splice(i, 1);
  }
  return true;
}

/* ---------------- damage modifiers --------------------------------- */

/** Weakness strings look like "Rx2" (×2) or "R+30" (+30). */
export function weaknessBonus(weakness: string | null | undefined, attackerType: string, base: number): number {
  if (!weakness || weakness === "None") return 0;
  const m = /^([A-Z])(x2|\+30|\+20)$/.exec(weakness.trim());
  if (!m || m[1] !== attackerType) return 0;
  return m[2] === "x2" ? base : Number(m[2]!.slice(1));
}

/** Resistance strings look like "W-30" or "W -30". */
export function resistanceCut(resistance: string | null | undefined, attackerType: string): number {
  if (!resistance || resistance === "None") return 0;
  const m = /^([A-Z])\s*-\s*(\d+)$/.exec(resistance.trim());
  if (!m || m[1] !== attackerType) return 0;
  return Number(m[2]);
}

const STATUS_PATTERNS: Array<[RegExp, PokeStatus]> = [
  [/now Asleep/i, "asleep"],
  [/now Paralyzed/i, "paralyzed"],
  [/now Poisoned/i, "poisoned"],
  [/now Burned/i, "burned"],
  [/now Confused/i, "confused"],
];

/** Status a move inflicts on the DEFENDING Pokémon, from its text. */
export function statusFromEffect(effect: string | undefined): PokeStatus | null {
  if (!effect) return null;
  if (/opponent's Active Pok[ée]mon (is|are) now|Defending Pok[ée]mon (is|are) now/i.test(effect)) {
    for (const [re, st] of STATUS_PATTERNS) if (re.test(effect)) return st;
  }
  return null;
}

/* ---------------- simulation --------------------------------------- */

interface SideState {
  fighters: PokeFighterState[];
  activeIdx: number;
  prizes: number;
}

/** Max HP of a fighter at its instance level/enhance (arena display). */
export function pokeMaxHp(f: PokeFighter): number {
  const lvl = f.level ?? 1;
  const enh = f.enhance ?? 0;
  return Math.round(f.hp * (1 + (lvl - 1) * 0.02)) + enh * 10;
}

function toState(f: PokeFighter): PokeFighterState {
  const lvl = f.level ?? 1;
  const enh = f.enhance ?? 0;
  const maxHp = pokeMaxHp(f);
  return {
    speciesId: f.speciesId, name: f.name, hp: maxHp, maxHp,
    energy: [], status: null, ko: false,
  };
}

const other = (s: "a" | "b"): "a" | "b" => (s === "a" ? "b" : "a");

export function simulatePokemonBattle(
  teamA: PokeFighter[],
  teamB: PokeFighter[],
  seed: string,
): PokemonBattleResult {
  const rng = rngFromSeed(hashSeed(seed));
  const sides: Record<"a" | "b", SideState> = {
    a: { fighters: teamA.slice(0, 5).map(toState), activeIdx: 0, prizes: 0 },
    b: { fighters: teamB.slice(0, 5).map(toState), activeIdx: 0, prizes: 0 },
  };
  const src: Record<"a" | "b", PokeFighter[]> = { a: teamA, b: teamB };
  const events: PokeEvent[] = [];
  let winner: "a" | "b" | null = null;
  let turn = 0;

  const active = (s: "a" | "b") => sides[s].fighters[sides[s].activeIdx]!;
  const fieldAlive = (s: "a" | "b") => sides[s].fighters.some((f) => !f.ko);

  const handleKo = (defSide: "a" | "b", atkSide: "a" | "b", atTurn: number) => {
    const def = active(defSide);
    if (def.hp > 0 || def.ko) return;
    def.ko = true;
    def.status = null;
    sides[atkSide].prizes += 1;
    events.push({
      turn: atTurn, side: atkSide, type: "ko", defender: def.name,
      prizes: [sides.a.prizes, sides.b.prizes],
      text: `${def.name} bị hạ (Knock Out)!`,
    });
    if (sides[atkSide].prizes >= PRIZES_TO_WIN || !fieldAlive(defSide)) {
      winner = atkSide;
      events.push({
        turn: atTurn, side: atkSide, type: "win",
        prizes: [sides.a.prizes, sides.b.prizes],
        text: sides[atkSide].prizes >= PRIZES_TO_WIN
          ? `Đủ ${PRIZES_TO_WIN} Prize — thắng trận!`
          : "Đối thủ không còn Pokémon nào trên sân — thắng trận!",
      });
      return;
    }
    // Promote the healthiest benched Pokémon.
    let best = -1;
    let bestHp = -1;
    sides[defSide].fighters.forEach((f, i) => {
      if (!f.ko && i !== sides[defSide].activeIdx && f.hp > bestHp) { best = i; bestHp = f.hp; }
    });
    if (best >= 0) {
      sides[defSide].activeIdx = best;
      events.push({
        turn: atTurn, side: defSide, type: "promote", defender: active(defSide).name,
        text: `${active(defSide).name} lên vị trí Active.`,
      });
    }
  };

  while (!winner && turn < MAX_TURNS) {
    turn += 1;
    for (const side of ["a", "b"] as const) {
      if (winner) break;
      const foe = other(side);
      const me = active(side);
      const enemy = active(foe);
      if (me.ko) continue;

      // 1) Energy: the Active gains 1 Energy of its own type.
      const mySrc = src[side][sides[side].activeIdx]!;
      me.energy.push(mySrc.type || "C");
      events.push({
        turn, side, type: "energy", attacker: me.name,
        text: `${me.name} nhận 1 Energy (${mySrc.type || "C"}).`,
      });

      // 2) Status gates before attacking.
      let canAttack = true;
      if (me.status === "asleep") {
        if (rng() < 0.5) {
          me.status = null;
          events.push({ turn, side, type: "wake", attacker: me.name, text: `${me.name} tỉnh dậy!` });
        } else {
          canAttack = false;
          events.push({ turn, side, type: "sleep-miss", attacker: me.name, text: `${me.name} đang ngủ, không tấn công được.` });
        }
      } else if (me.status === "paralyzed") {
        me.status = null;
        canAttack = false;
        events.push({ turn, side, type: "paralysis-miss", attacker: me.name, text: `${me.name} bị tê liệt, mất lượt tấn công.` });
      } else if (me.status === "confused") {
        if (rng() >= 0.5) {
          me.hp -= 30;
          canAttack = false;
          events.push({
            turn, side, type: "confusion-self", attacker: me.name, damage: 30, defenderHp: Math.max(0, me.hp),
            text: `${me.name} rối loạn và tự làm mình bị thương 30!`,
          });
          handleKo(side, foe, turn);
          if (winner) break;
          if (me.ko) continue;
        }
      }

      // 3) Attack with the strongest affordable move.
      if (canAttack) {
        const foeSrc = src[foe][sides[foe].activeIdx]!;
        const affordable = mySrc.moves.filter((m) => canPay(me.energy, m.cost));
        const move = affordable.sort((x, y) => y.damage - x.damage)[0];
        if (!move) {
          events.push({
            turn, side, type: "no-energy", attacker: me.name,
            text: `${me.name} chưa đủ Energy để tấn công.`,
          });
        } else {
          const weak = weaknessBonus(foeSrc.weakness, mySrc.type, move.damage);
          const resist = resistanceCut(foeSrc.resistance, mySrc.type);
          let damage = Math.max(0, move.damage + weak - resist);
          if (move.damage === 0) damage = 0;
          enemy.hp -= damage;
          events.push({
            turn, side, type: "attack", move: move.name, damage,
            modifier: weak > 0 ? "weakness" : resist > 0 ? "resistance" : null,
            attacker: me.name, defender: enemy.name, defenderHp: Math.max(0, enemy.hp),
            text: `${me.name} dùng ${move.name} — ${damage} sát thương${weak > 0 ? " (điểm yếu ×2!)" : resist > 0 ? " (bị kháng)" : ""}.`,
          });
          const st = statusFromEffect(move.effect);
          if (st && enemy.hp > 0 && !enemy.ko) {
            enemy.status = st;
            events.push({
              turn, side, type: "status-inflicted", status: st, defender: enemy.name,
              text: `${enemy.name} bị ${st === "asleep" ? "ru ngủ" : st === "paralyzed" ? "tê liệt" : st === "poisoned" ? "trúng độc" : st === "burned" ? "bỏng" : "rối loạn"}!`,
            });
          }
          handleKo(foe, side, turn);
          if (winner) break;
        }
      }

      // 4) Between-turns status damage on MY active (poison/burn).
      if (!winner && !me.ko && (me.status === "poisoned" || me.status === "burned")) {
        const tick = me.status === "poisoned" ? 10 : 20;
        me.hp -= tick;
        events.push({
          turn, side, type: "status-tick", status: me.status, attacker: me.name,
          damage: tick, defenderHp: Math.max(0, me.hp),
          text: `${me.name} chịu ${tick} sát thương vì ${me.status === "poisoned" ? "trúng độc" : "bỏng"}.`,
        });
        handleKo(side, foe, turn);
      }
    }
  }

  if (!winner) {
    // Turn cap: more prizes wins; tie → more remaining HP.
    if (sides.a.prizes !== sides.b.prizes) winner = sides.a.prizes > sides.b.prizes ? "a" : "b";
    else {
      const hpA = sides.a.fighters.reduce((s, f) => s + Math.max(0, f.hp), 0);
      const hpB = sides.b.fighters.reduce((s, f) => s + Math.max(0, f.hp), 0);
      winner = hpA >= hpB ? "a" : "b";
    }
  }

  return {
    winner,
    turns: turn,
    prizes: [sides.a.prizes, sides.b.prizes],
    events,
    finalA: sides.a.fighters,
    finalB: sides.b.fighters,
  };
}

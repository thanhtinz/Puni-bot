/**
 * Digimon Card Game battle engine (spec 6.39i) — web mirror of
 * bot/src/services/digimon-battle.ts. A pure,
 * deterministic simulation of a REAL Digimon match, scoped to what
 * the card data supports:
 *
 * - Shared Memory Gauge (-10..+10): the active player spends memory
 *   on plays and digivolutions; when a payment pushes the gauge past
 *   0 to the opponent's side the turn ends, and the opponent starts
 *   with that much memory. Passing voluntarily sets the opponent to 3
 *   (official rule).
 * - Setup: 5-card opening hand, 5 face-down Security cards, one Lv.2
 *   Digimon in the Breeding Area (from the deck).
 * - Turn: Unsuspend -> Draw (skipped on the game's first turn) ->
 *   Breeding (digivolve in the breeding area, or move a Lv.3+ out) ->
 *   Main (play / digivolve / attack in any order while memory lasts).
 * - Digivolution: a hand card whose printed requirement matches the
 *   target's level AND colour; pay the evo cost, then draw 1. The
 *   stack keeps the new top card's DP.
 * - Attacks: the attacker suspends. It may target a SUSPENDED enemy
 *   Digimon or the enemy player. Vs a Digimon, higher DP survives
 *   (tie deletes both). Vs the player, the top Security card flips
 *   and battles by DP (Option/Tamer security is impossible here —
 *   decks are Digimon-only — so every security card battles); if the
 *   security stack is empty the attack wins the game outright.
 * - [Blocker]: the defender may suspend a Blocker to redirect an
 *   attack onto it (AI blocks direct attacks when Security is low or
 *   the trade is favourable, and body-blocks for a stronger Digimon
 *   it can kill).
 * - A Digimon cannot attack the turn it was played (unless [Rush]).
 * - Deck-out on draw loses. Turn cap 60: more Security wins, then
 *   higher total field DP, then the second player wins the tie.
 *
 * Out of scope for v1: Tamer/Option cards, inherited effects and
 * printed effects beyond [Blocker]/[Rush], Digi-Egg deck building
 * (the breeding Lv.2 comes from the main deck).
 */

export interface DigCard {
  speciesId: string;
  name: string;
  spriteUrl: string;
  level: number;
  dp: number;
  cost: number;
  evoCost: number | null;
  evoLevel: number | null;
  evoColor: string | null;
  /** Printed colour(s), may be "Red;White". */
  color: string;
  blocker: boolean;
  rush: boolean;
  enhance: number;
}

export type DigEventType =
  | "unsuspend" | "draw" | "hatch" | "move" | "play" | "digivolve"
  | "attack" | "block" | "security" | "delete" | "pass" | "deckout" | "win";

export interface DigEvent {
  type: DigEventType;
  side: "a" | "b";
  text: string;
  name?: string;
  targetName?: string;
  /** Memory gauge after this event, from side A's perspective. */
  memory: number;
  securityA: number;
  securityB: number;
}

export interface DigimonBattleResult {
  winner: "a" | "b";
  turns: number;
  events: DigEvent[];
  securityA: number;
  securityB: number;
}

export const DIG_MAX_TURNS = 60;
const FIELD_LIMIT = 5;

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngFromSeed(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function effDp(card: DigCard): number {
  return card.dp + card.enhance * 500;
}

function colorsOf(card: DigCard): string[] {
  return card.color.split(";").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Can `evo` digivolve onto `base`? Printed level + colour must match. */
export function canDigivolve(evo: DigCard, base: DigCard): boolean {
  if (evo.evoLevel === null || evo.evoCost === null) return false;
  if (evo.evoLevel !== base.level) return false;
  if (!evo.evoColor) return true;
  return colorsOf(base).includes(evo.evoColor.trim().toLowerCase());
}

interface FieldMon {
  card: DigCard;
  sources: number;
  suspended: boolean;
  enteredTurn: number;
}

interface SideState {
  deck: DigCard[];
  hand: DigCard[];
  field: FieldMon[];
  breeding: FieldMon | null;
  security: DigCard[];
  trash: number;
}

function shuffled(deck: DigCard[], rng: () => number): DigCard[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function simulateDigimonBattle(
  deckA: DigCard[],
  deckB: DigCard[],
  seedText: string,
  eggA?: DigCard | null,
  eggB?: DigCard | null,
): DigimonBattleResult {
  const rng = rngFromSeed(hashSeed(seedText));
  const events: DigEvent[] = [];
  // Gauge from A's perspective: positive = A's side.
  let gauge = 0;

  const mkSide = (deck: DigCard[]): SideState => {
    const d = shuffled(deck, rng);
    const security = d.splice(0, 5);
    const hand = d.splice(0, 5);
    // Breeding: first Lv.2 in the remaining deck hatches.
    let breeding: FieldMon | null = null;
    const idx = d.findIndex((c) => c.level === 2);
    if (idx >= 0) {
      const [egg] = d.splice(idx, 1);
      breeding = { card: egg, sources: 0, suspended: false, enteredTurn: -1 };
    }
    return { deck: d, hand, field: [], breeding, security, trash: 0 };
  };
  const sides: Record<"a" | "b", SideState> = { a: mkSide(deckA), b: mkSide(deckB) };
  // A provided Digi-Egg (the real game's separate egg deck) takes
  // the Breeding Area slot instead of a Lv.2 fished from the deck.
  const setEgg = (side: SideState, egg: DigCard) => {
    if (side.breeding) side.deck.push(side.breeding.card);
    side.breeding = { card: egg, sources: 0, suspended: false, enteredTurn: -1 };
  };
  if (eggA) setEgg(sides.a, eggA);
  if (eggB) setEgg(sides.b, eggB);
  const other = (s: "a" | "b"): "a" | "b" => (s === "a" ? "b" : "a");

  const push = (type: DigEventType, side: "a" | "b", text: string, extra?: Partial<DigEvent>) => {
    events.push({
      type, side, text,
      memory: gauge,
      securityA: sides.a.security.length,
      securityB: sides.b.security.length,
      ...extra,
    });
  };

  // Announce the setup breeding occupants so replays can show them.
  for (const s of ["a", "b"] as const) {
    const b = sides[s].breeding;
    if (b) push("hatch", s, `${b.card.name} bắt đầu trong khu Breeding.`, { name: b.card.name });
  }

  let winner: "a" | "b" | null = null;
  let turn = 0;
  let active: "a" | "b" = "a";
  // Memory available to the active player right now.
  let memory = 0;

  const drawCards = (s: "a" | "b", n: number): boolean => {
    const st = sides[s];
    for (let i = 0; i < n; i++) {
      const c = st.deck.pop();
      if (!c) return false;
      st.hand.push(c);
    }
    return true;
  };

  const deleteMon = (s: "a" | "b", mon: FieldMon) => {
    const st = sides[s];
    st.field = st.field.filter((m) => m !== mon);
    st.trash += 1 + mon.sources;
    push("delete", s, `${mon.card.name} bị xoá khỏi sân.`, { name: mon.card.name });
  };

  const resolveAttack = (atkSide: "a" | "b", attacker: FieldMon, target: FieldMon | "player") => {
    const defSide = other(atkSide);
    const def = sides[defSide];
    attacker.suspended = true;

    // Blocker: defender may redirect onto an unsuspended Blocker.
    {
      const blocker = def.field.find((m) => m.card.blocker && !m.suspended && m !== target);
      if (blocker) {
        const atkDp = effDp(attacker.card);
        const targetIsPlayer = target === "player";
        const worth =
          (targetIsPlayer && (def.security.length <= 2 || effDp(blocker.card) >= atkDp)) ||
          (!targetIsPlayer && effDp((target as FieldMon).card) > effDp(blocker.card) && effDp(blocker.card) >= atkDp);
        if (worth) {
          blocker.suspended = true;
          push("block", defSide, `${blocker.card.name} [Blocker] chắn đòn thay.`, {
            name: blocker.card.name, targetName: attacker.card.name,
          });
          target = blocker;
        }
      }
    }

    if (target === "player") {
      push("attack", atkSide, `${attacker.card.name} tấn công trực tiếp đối thủ!`, { name: attacker.card.name });
      const sec = def.security.pop();
      if (!sec) {
        winner = atkSide;
        push("win", atkSide, `${attacker.card.name} đánh xuyên Security trống — thắng trận!`, { name: attacker.card.name });
        return;
      }
      const sDp = effDp(sec);
      const aDp = effDp(attacker.card);
      if (aDp > sDp) {
        def.trash += 1;
        push("security", defSide, `Security ${sec.name} (${sDp.toLocaleString("en-US")} DP) bị phá.`, {
          name: sec.name, targetName: attacker.card.name,
        });
      } else if (aDp < sDp) {
        push("security", defSide, `Security ${sec.name} (${sDp.toLocaleString("en-US")} DP) chặn đứng ${attacker.card.name}.`, {
          name: sec.name, targetName: attacker.card.name,
        });
        deleteMon(atkSide, attacker);
      } else {
        def.trash += 1;
        push("security", defSide, `Security ${sec.name} hoà DP — cả hai cùng bị loại.`, {
          name: sec.name, targetName: attacker.card.name,
        });
        deleteMon(atkSide, attacker);
      }
      return;
    }

    // Vs a suspended Digimon.
    const foe = target as FieldMon;
    push("attack", atkSide, `${attacker.card.name} tấn công ${foe.card.name}.`, {
      name: attacker.card.name, targetName: foe.card.name,
    });
    const aDp = effDp(attacker.card);
    const dDp = effDp(foe.card);
    if (aDp > dDp) deleteMon(defSide, foe);
    else if (aDp < dDp) deleteMon(atkSide, attacker);
    else {
      deleteMon(defSide, foe);
      if (sides[atkSide].field.includes(attacker)) deleteMon(atkSide, attacker);
    }
  };

  while (!winner && turn < DIG_MAX_TURNS) {
    turn += 1;
    const me = sides[active];
    const foeSide = other(active);
    const foe = sides[foeSide];
    memory = active === "a" ? gauge : -gauge;
    if (memory > 10) memory = 10;

    // Unsuspend phase.
    for (const m of me.field) m.suspended = false;
    push("unsuspend", active, `Lượt ${turn} — ${active === "a" ? "Bạn" : "Đối thủ"} bắt đầu (Memory ${memory}).`);

    // Draw phase (the game's first turn skips it).
    if (turn > 1) {
      if (!drawCards(active, 1)) {
        winner = foeSide;
        push("deckout", active, "Hết bài để rút — thua trận.", {});
        break;
      }
      push("draw", active, "Rút 1 lá.", {});
    }

    // Breeding phase.
    if (!me.breeding) {
      const idx = me.deck.findIndex((c) => c.level === 2);
      if (idx >= 0) {
        const [egg] = me.deck.splice(idx, 1);
        me.breeding = { card: egg, sources: 0, suspended: false, enteredTurn: turn };
        push("hatch", active, `Ấp ${egg.name} vào khu Breeding.`, { name: egg.name });
      }
    } else {
      const b = me.breeding;
      const evoIdx = me.hand.findIndex((c) => canDigivolve(c, b.card) && (c.evoCost ?? 0) <= memory + 10);
      if (evoIdx >= 0) {
        const [evo] = me.hand.splice(evoIdx, 1);
        memory -= evo.evoCost ?? 0;
        gauge = active === "a" ? memory : -memory;
        b.card = evo;
        b.sources += 1;
        push("digivolve", active, `Breeding: tiến hoá thành ${evo.name} (${effDp(evo).toLocaleString("en-US")} DP).`, { name: evo.name });
        drawCards(active, 1);
      } else if (b.card.level >= 3) {
        me.field.push(b);
        me.breeding = null;
        push("move", active, `${b.card.name} rời Breeding ra sân.`, { name: b.card.name });
      }
    }

    // Main phase: act while memory >= 0. (If breeding already pushed
    // the gauge past 0, the turn ends before the main phase.) Costs
    // may overspend the gauge down to -10 — paying past 0 is exactly
    // how a turn ends in the real game — but the AI prefers actions
    // that keep the turn alive and overspends only as its last move.
    let guard = 0;
    while (!winner && memory >= 0 && guard++ < 14) {
      // 1) Digivolve on the field for a real DP gain.
      let acted = false;
      for (const mon of [...me.field]) {
        const fits = (cap: number) =>
          me.hand.findIndex(
            (c) => canDigivolve(c, mon.card) && (c.evoCost ?? 0) <= cap && effDp(c) - effDp(mon.card) >= 1000,
          );
        const idx = fits(memory) >= 0 ? fits(memory) : fits(memory + 10);
        if (idx >= 0) {
          const [evo] = me.hand.splice(idx, 1);
          memory -= evo.evoCost ?? 0;
          gauge = active === "a" ? memory : -memory;
          const from = mon.card.name;
          mon.card = evo;
          mon.sources += 1;
          push("digivolve", active, `${from} tiến hoá thành ${evo.name} (${effDp(evo).toLocaleString("en-US")} DP).`, {
            name: evo.name, targetName: from,
          });
          drawCards(active, 1);
          acted = true;
          break;
        }
      }
      if (acted) {
        if (memory < 0) break;
        continue;
      }

      // 2) Attacks with every ready Digimon (they cost no memory).
      let attacked = false;
      for (const mon of [...me.field]) {
        if (winner) break;
        if (mon.suspended) continue;
        if (mon.enteredTurn === turn && !mon.card.rush) continue;
        const aDp = effDp(mon.card);
        const killable = foe.field
          .filter((m) => m.suspended && effDp(m.card) < aDp && effDp(m.card) >= 3000)
          .sort((x, y) => effDp(y.card) - effDp(x.card))[0];
        if (killable) {
          resolveAttack(active, mon, killable);
          attacked = true;
        } else if (aDp >= 5000 || foe.security.length <= 2 || foe.field.length === 0) {
          resolveAttack(active, mon, "player");
          attacked = true;
        }
      }
      if (attacked) continue;

      // 3) Play the strongest Digimon: within memory if possible,
      // otherwise one overspending play as the turn's last move.
      if (me.field.length < FIELD_LIMIT) {
        const pick = (cap: number) => {
          let bestIdx = -1;
          let bestDp = -1;
          me.hand.forEach((c, i) => {
            if (c.cost <= cap && effDp(c) > bestDp) {
              bestDp = effDp(c);
              bestIdx = i;
            }
          });
          return bestIdx;
        };
        const bestIdx = pick(memory) >= 0 ? pick(memory) : pick(memory + 10);
        if (bestIdx >= 0) {
          const [card] = me.hand.splice(bestIdx, 1);
          memory -= card.cost;
          gauge = active === "a" ? memory : -memory;
          me.field.push({ card, sources: 0, suspended: false, enteredTurn: turn });
          push("play", active, `Ra trận ${card.name} (Cost ${card.cost} · ${effDp(card).toLocaleString("en-US")} DP).`, { name: card.name });
          if (memory < 0) break;
          continue;
        }
      }

      break; // nothing useful left to do
    }

    if (winner) break;

    // Turn end: memory < 0 already sits on the opponent's side;
    // a voluntary pass hands the opponent 3.
    if (memory >= 0) {
      gauge = active === "a" ? -3 : 3;
      push("pass", active, "Qua lượt — đối thủ nhận 3 Memory.", {});
    } else {
      gauge = active === "a" ? memory : -memory;
    }
    active = foeSide;
  }

  if (!winner) {
    const score = (s: SideState) =>
      s.security.length * 100000 + s.field.reduce((sum, m) => sum + effDp(m.card), 0);
    winner = score(sides.a) > score(sides.b) ? "a" : "b";
    push("win", winner, "Hết lượt tối đa — phân thắng bại bằng Security còn lại và tổng DP sân.", {});
  }

  return {
    winner,
    turns: turn,
    events,
    securityA: sides.a.security.length,
    securityB: sides.b.security.length,
  };
}

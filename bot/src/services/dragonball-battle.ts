/**
 * Dragon Ball Super Card Game — Fusion World battle engine
 * (spec 6.39). Pure and deterministic per seed: the same decks and
 * seed always produce the same event stream, which the web arena
 * replays. Rules follow the real Fusion World game, scoped to
 * Leader + Battle Cards:
 *
 *  - Each duelist starts with 8 Life (cards set aside from the
 *    deck); lost Life goes to the hand (or the trash when the
 *    attacker has [Critical]).
 *  - Charge Phase: everything switches back to Active Mode and the
 *    player draws 1 card. The first player skips the draw and
 *    cannot attack on turn 1.
 *  - Once per turn, 1 card from the hand becomes energy. Playing a
 *    Battle Card rests energy equal to its cost. A Battle Card
 *    cannot attack the turn it was played (unless it has [Rush]).
 *  - Combat: the attacker (Leader or Battle Card, rested by
 *    attacking) strikes the enemy Leader or one of their RESTED
 *    Battle Cards. The defender may combo from the hand — each
 *    combo card rests 1 energy and adds its Combo Power for this
 *    battle only; the attacker may combo back. The attacker wins
 *    the battle at equal or higher power: a Battle Card is K.O.'d,
 *    a Leader loses 1 Life. A Leader at 0 Life loses when the next
 *    hit lands.
 *  - [Awaken] At 4 Life or less, at the start of their turn the
 *    Leader flips to its awakened side (higher power) and the
 *    player draws 1 card.
 *  - Losing also happens by deck-out. After the turn cap, more
 *    Life wins, then higher total field power.
 *
 * Card skills beyond [Rush]/[Critical] and Extra cards are out of
 * scope for v1 — decks are Battle Cards only.
 */

export interface DbCard {
  speciesId: string;
  name: string;
  cost: number;
  power: number;
  /** Leader awakened (back side) power. */
  powerAwake?: number;
  combo: number;
  kind: "Leader" | "Battle";
  rush?: boolean;
  critical?: boolean;
  enhance?: number;
}

export interface DbEvent {
  turn: number;
  side: "a" | "b";
  type:
    | "draw" | "energy" | "play" | "attack" | "combo"
    | "ko" | "life" | "awaken" | "deckout" | "win";
  card?: string;
  target?: string;
  text: string;
  lifeA: number;
  lifeB: number;
  energyA: number;
  energyMaxA: number;
  energyB: number;
  energyMaxB: number;
}

export interface DragonBallBattleResult {
  winner: "a" | "b";
  turns: number;
  events: DbEvent[];
  life: [number, number];
}

export const DB_START_LIFE = 8;
export const DB_MAX_TURNS = 40;

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
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

const effPower = (c: DbCard): number => c.power + (c.enhance ?? 0) * 500;
const leaderPower = (c: DbCard, awakened: boolean): number =>
  (awakened ? c.powerAwake ?? c.power : c.power) + (c.enhance ?? 0) * 500;

interface FieldCard {
  card: DbCard;
  rested: boolean;
  playedTurn: number;
}

interface Duelist {
  leader: DbCard;
  awakened: boolean;
  leaderRested: boolean;
  life: DbCard[];
  deck: DbCard[];
  hand: DbCard[];
  field: FieldCard[];
  energyTotal: number;
  energyRested: number;
}

export function simulateDragonBallBattle(
  leaderA: DbCard,
  deckAIn: DbCard[],
  leaderB: DbCard,
  deckBIn: DbCard[],
  seed: string,
): DragonBallBattleResult {
  const rng = rngFromSeed(hashSeed(seed));
  const shuffle = (arr: DbCard[]): DbCard[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };
  const mk = (leader: DbCard, deckIn: DbCard[]): Duelist => {
    const deck = shuffle(deckIn);
    const life = deck.splice(0, DB_START_LIFE);
    const hand = deck.splice(0, 6);
    return {
      leader, awakened: false, leaderRested: false,
      life, deck, hand, field: [], energyTotal: 0, energyRested: 0,
    };
  };
  const sides: Record<"a" | "b", Duelist> = { a: mk(leaderA, deckAIn), b: mk(leaderB, deckBIn) };
  const foeOf = (s: "a" | "b"): "a" | "b" => (s === "a" ? "b" : "a");
  const events: DbEvent[] = [];
  let winner: "a" | "b" | null = null;

  const push = (turn: number, side: "a" | "b", type: DbEvent["type"], text: string, card?: string, target?: string) => {
    events.push({
      turn, side, type, text, card, target,
      lifeA: sides.a.life.length, lifeB: sides.b.life.length,
      energyA: sides.a.energyTotal - sides.a.energyRested, energyMaxA: sides.a.energyTotal,
      energyB: sides.b.energyTotal - sides.b.energyRested, energyMaxB: sides.b.energyTotal,
    });
  };

  const drawCards = (turn: number, side: "a" | "b", n: number): boolean => {
    const me = sides[side];
    for (let i = 0; i < n; i++) {
      const c = me.deck.pop();
      if (!c) {
        push(turn, side, "deckout", `${side === "a" ? "Bạn" : "Đối thủ"} hết bài để rút và thua.`);
        winner = foeOf(side);
        return false;
      }
      me.hand.push(c);
    }
    push(turn, side, "draw", `Rút ${n} lá.`);
    return true;
  };

  /** Combo from the hand: rest 1 energy per card, smallest first,
   * only while it can still flip the battle. Returns added power. */
  const comboStep = (
    turn: number, side: "a" | "b", myPower: number, foePower: number,
  ): number => {
    const me = sides[side];
    let added = 0;
    for (;;) {
      if (myPower + added > foePower) break;
      const avail = me.energyTotal - me.energyRested;
      if (avail < 1) break;
      const candidates = me.hand
        .filter((c) => c.combo > 0)
        .sort((x, y) => x.combo - y.combo);
      const pick = candidates[0];
      if (!pick) break;
      me.hand.splice(me.hand.indexOf(pick), 1);
      me.energyRested += 1;
      added += pick.combo;
      push(turn, side, "combo", `Combo ${pick.name} (+${pick.combo.toLocaleString("en-US")} Power).`, pick.name);
    }
    return added;
  };

  const resolveAttack = (
    turn: number, side: "a" | "b",
    attackerName: string, attackerPower: number, attackerCritical: boolean,
    targetFieldIdx: number | null, // null = the enemy Leader
  ): void => {
    const me = sides[side];
    const foe = sides[foeOf(side)];
    const targetName = targetFieldIdx === null ? foe.leader.name : foe.field[targetFieldIdx]!.card.name;
    const targetBase = targetFieldIdx === null
      ? leaderPower(foe.leader, foe.awakened)
      : effPower(foe.field[targetFieldIdx]!.card);
    push(turn, side, "attack", `${attackerName} (Power ${attackerPower.toLocaleString("en-US")}) tấn công ${targetName}!`, attackerName, targetName);

    // Defender combos to save the Leader, or a heavy Battle Card.
    let defPower = targetBase;
    const worthSaving = targetFieldIdx === null || targetBase >= 20000;
    if (worthSaving && defPower <= attackerPower) {
      defPower += comboStep(turn, foeOf(side), defPower, attackerPower);
    }
    // Attacker combos back only when striking the Leader.
    let attPower = attackerPower;
    if (targetFieldIdx === null && attPower < defPower) {
      attPower += comboStep(turn, side, attPower, defPower);
    }
    if (attPower < defPower) {
      push(turn, side, "attack", `${targetName} đỡ được đòn tấn công.`, attackerName, targetName);
      return;
    }
    if (targetFieldIdx === null) {
      if (foe.life.length === 0) {
        winner = side;
        return;
      }
      const lost = foe.life.pop()!;
      if (attackerCritical) {
        push(turn, side, "life", `${foe.leader.name} mất 1 Life (Critical — lá Life vào Trash thay vì lên tay).`, attackerName, foe.leader.name);
      } else {
        foe.hand.push(lost);
        push(turn, side, "life", `${foe.leader.name} mất 1 Life.`, attackerName, foe.leader.name);
      }
    } else {
      const [dead] = foe.field.splice(targetFieldIdx, 1);
      push(turn, side, "ko", `${dead!.card.name} bị K.O.!`, attackerName, dead!.card.name);
    }
  };

  let turn = 0;
  outer: while (!winner && turn < DB_MAX_TURNS) {
    turn += 1;
    for (const side of ["a", "b"] as const) {
      if (winner) break;
      const me = sides[side];
      const foe = sides[foeOf(side)];
      const firstEver = turn === 1 && side === "a";

      // Awaken at the start of the turn.
      if (!me.awakened && me.life.length <= 4) {
        me.awakened = true;
        push(turn, side, "awaken", `${me.leader.name} AWAKEN! Power tăng lên ${leaderPower(me.leader, true).toLocaleString("en-US")}.`, me.leader.name);
        if (!drawCards(turn, side, 1)) break outer;
      }

      // Charge Phase: untap + draw (first player skips the draw).
      me.leaderRested = false;
      me.energyRested = 0;
      for (const f of me.field) f.rested = false;
      if (!firstEver) {
        if (!drawCards(turn, side, 1)) break outer;
      }

      // Energy: place the weakest hand card as energy, once per turn.
      if (me.hand.length > 0 && me.energyTotal < 10) {
        const sorted = [...me.hand].sort(
          (x, y) => effPower(x) + x.combo - (effPower(y) + y.combo),
        );
        const pick = sorted[0]!;
        me.hand.splice(me.hand.indexOf(pick), 1);
        me.energyTotal += 1;
        push(turn, side, "energy", `Đặt ${pick.name} làm Energy (tổng ${me.energyTotal}).`, pick.name);
      }

      // Main: play Battle Cards, strongest affordable first.
      for (;;) {
        const avail = me.energyTotal - me.energyRested;
        const playable = me.hand
          .filter((c) => c.cost <= avail)
          .sort((x, y) => effPower(y) - effPower(x));
        const pick = playable[0];
        if (!pick || me.field.length >= 7) break;
        me.hand.splice(me.hand.indexOf(pick), 1);
        me.energyRested += pick.cost;
        me.field.push({ card: pick, rested: false, playedTurn: turn });
        push(turn, side, "play", `Ra trận ${pick.name} (Cost ${pick.cost} · Power ${effPower(pick).toLocaleString("en-US")}).`, pick.name);
      }

      if (firstEver) continue; // first player cannot attack on turn 1

      // Attacks: Leader first, then Battle Cards.
      const tryAttack = (name: string, power: number, critical: boolean, rest: () => void) => {
        if (winner) return;
        // Prefer K.O.-ing a rested enemy Battle Card worth removing.
        let targetIdx: number | null = null;
        let best = -1;
        foe.field.forEach((f, i) => {
          if (f.rested && effPower(f.card) <= power && effPower(f.card) > best) {
            best = effPower(f.card);
            targetIdx = i;
          }
        });
        if (targetIdx === null && power < leaderPower(foe.leader, foe.awakened)) {
          // Cannot pressure the Leader — stay Active instead.
          return;
        }
        rest();
        resolveAttack(turn, side, name, power, critical, targetIdx);
      };

      if (!me.leaderRested) {
        tryAttack(me.leader.name, leaderPower(me.leader, me.awakened), false, () => {
          me.leaderRested = true;
        });
      }
      for (const f of [...me.field]) {
        if (winner) break;
        if (f.rested) continue;
        if (f.playedTurn === turn && !f.card.rush) continue;
        tryAttack(f.card.name, effPower(f.card), !!f.card.critical, () => {
          f.rested = true;
        });
      }
    }
  }

  if (!winner) {
    const score = (s: Duelist): number =>
      s.life.length * 100000 + s.field.reduce((sum, f) => sum + effPower(f.card), 0);
    winner = score(sides.a) >= score(sides.b) ? "a" : "b";
  }
  push(turn, winner, "win", winner === "a" ? "Bạn thắng trận!" : "Đối thủ thắng trận.");
  return {
    winner,
    turns: turn,
    events,
    life: [sides.a.life.length, sides.b.life.length],
  };
}

/**
 * Yu-Gi-Oh duel engine (spec 6.39) — real-rules core, scoped v1.
 *
 * Each duelist starts at 8000 LP with a 5-card opening hand drawn
 * from their own deck list, then plays official turn structure:
 * Draw → Main (one Normal Summon per turn; Level 5-6 needs 1
 * Tribute, Level 7+ needs 2) → Battle (each Attack-Position monster
 * attacks once) → End. Combat follows the real rules:
 *  - ATK vs ATK: the weaker monster is destroyed and its controller
 *    takes the difference as LP damage; equal ATK destroys both.
 *  - ATK vs DEF: ATK > DEF destroys the defender with no LP damage;
 *    ATK < DEF bounces off and the ATTACKER's controller takes the
 *    difference; equal does nothing.
 *  - No opposing monsters: direct attack for full ATK as LP damage.
 * A duelist loses at 0 LP or when they must draw from an empty deck.
 * Spell/Trap cards and monster effects are out of scope for v1 —
 * decks here are monster-only (the catalog import only carries
 * monsters with real ATK/DEF from YGOPRODeck).
 * Deterministic per seed; emits an event stream for the arena.
 */

export interface YgoCard {
  speciesId: string;
  name: string;
  atk: number;
  def: number;
  level: number;
  attribute?: string;
  race?: string;
  enhance?: number;
  /** Link Monster: no DEF and no Level — it is always in Attack
   * Position and battles resolve against its ATK only. */
  link?: boolean;
}

export type YgoPosition = "attack" | "defense";

export interface YgoFieldMonster {
  card: YgoCard;
  position: YgoPosition;
  /** Turn number this monster was summoned (position-change rule). */
  summonedTurn: number;
  attackedThisTurn: boolean;
}

export interface YgoEvent {
  turn: number;
  side: "a" | "b";
  type:
    | "draw" | "summon" | "tribute" | "position" | "attack"
    | "direct" | "destroy" | "lp" | "deckout" | "win";
  card?: string;
  target?: string;
  damage?: number;
  position?: YgoPosition;
  tributes?: string[];
  lpA: number;
  lpB: number;
  text: string;
}

export interface YugiohBattleResult {
  winner: "a" | "b";
  turns: number;
  lp: [number, number];
  events: YgoEvent[];
  fieldA: YgoFieldMonster[];
  fieldB: YgoFieldMonster[];
}

export const YGO_START_LP = 8000;
const MAX_TURNS = 60;
const FIELD_LIMIT = 5;

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

const effAtk = (c: YgoCard) => c.atk + (c.enhance ?? 0) * 50;
const effDef = (c: YgoCard) => c.def + (c.enhance ?? 0) * 50;
export const tributesNeeded = (level: number) => (level >= 7 ? 2 : level >= 5 ? 1 : 0);

interface Duelist {
  deck: YgoCard[];
  hand: YgoCard[];
  field: YgoFieldMonster[];
  grave: YgoCard[];
  lp: number;
}

const other = (s: "a" | "b"): "a" | "b" => (s === "a" ? "b" : "a");

function shuffled(cards: YgoCard[], rng: () => number): YgoCard[] {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function simulateYugiohBattle(
  deckA: YgoCard[],
  deckB: YgoCard[],
  seed: string,
): YugiohBattleResult {
  const rng = rngFromSeed(hashSeed(seed));
  const mk = (deck: YgoCard[]): Duelist => {
    const d = shuffled(deck, rng);
    return { deck: d.slice(5), hand: d.slice(0, 5), field: [], grave: [], lp: YGO_START_LP };
  };
  const sides: Record<"a" | "b", Duelist> = { a: mk(deckA), b: mk(deckB) };
  const events: YgoEvent[] = [];
  let winner: "a" | "b" | null = null;
  let turn = 0;

  const lpPair = (): [number, number] => [sides.a.lp, sides.b.lp];
  const push = (e: Omit<YgoEvent, "lpA" | "lpB">) => {
    const [lpA, lpB] = lpPair();
    events.push({ ...e, lpA, lpB });
  };
  const destroy = (side: "a" | "b", m: YgoFieldMonster, atTurn: number) => {
    const d = sides[side];
    d.field = d.field.filter((x) => x !== m);
    d.grave.push(m.card);
    push({ turn: atTurn, side, type: "destroy", card: m.card.name, text: `${m.card.name} bị phá huỷ và xuống mộ.` });
  };
  const damage = (side: "a" | "b", amount: number, atTurn: number, why: string) => {
    if (amount <= 0) return;
    sides[side].lp -= amount;
    push({ turn: atTurn, side, type: "lp", damage: amount, text: `${why} — LP giảm ${amount}.` });
    if (sides[side].lp <= 0) winner = other(side);
  };

  while (!winner && turn < MAX_TURNS) {
    turn += 1;
    for (const side of ["a", "b"] as const) {
      if (winner) break;
      const me = sides[side];
      const foe = sides[other(side)];

      // ---- Draw Phase (the very first turn of the duel skips it) ----
      if (turn > 1 || side === "b") {
        if (!me.deck.length) {
          push({ turn, side, type: "deckout", text: "Không còn bài để rút — thua vì deck out!" });
          winner = other(side);
          break;
        }
        const drawn = me.deck.shift()!;
        me.hand.push(drawn);
        push({ turn, side, type: "draw", card: drawn.name, text: `Rút 1 lá.` });
      }

      // ---- Main Phase: one Normal Summon ----
      const summonable = me.hand
        .map((card, handIdx) => ({ card, handIdx }))
        .filter(({ card }) => {
          const need = tributesNeeded(card.level);
          return need === 0 ? me.field.length < FIELD_LIMIT : me.field.length >= need;
        })
        .sort((x, y) => effAtk(y.card) - effAtk(x.card));
      const pick = summonable[0];
      if (pick) {
        const need = tributesNeeded(pick.card.level);
        const tributes: string[] = [];
        if (need > 0) {
          // Tribute the weakest monsters on the field.
          const weakest = [...me.field].sort((x, y) => effAtk(x.card) - effAtk(y.card)).slice(0, need);
          // Only tribute up when the new monster clearly outclasses them.
          const worthIt = weakest.every((w) => effAtk(pick.card) > effAtk(w.card) + 300);
          if (worthIt) {
            for (const w of weakest) {
              tributes.push(w.card.name);
              me.field = me.field.filter((x) => x !== w);
              me.grave.push(w.card);
            }
            push({ turn, side, type: "tribute", card: pick.card.name, tributes, text: `Hiến tế ${tributes.join(", ")}.` });
          }
        }
        if (need === 0 || tributes.length === need) {
          me.hand.splice(me.hand.indexOf(pick.card), 1);
          const foeBestAtk = Math.max(0, ...foe.field.filter((m) => m.position === "attack").map((m) => effAtk(m.card)));
          // Walls (DEF far above ATK) belong in Defense Position; a
          // monster that cannot beat the opposing field also defends
          // when its DEF covers it; everything else attacks.
          const position: YgoPosition = pick.card.link
            ? "attack"
            : effDef(pick.card) >= effAtk(pick.card) + 500 ? "defense"
            : effAtk(pick.card) >= foeBestAtk ? "attack"
            : effDef(pick.card) > effAtk(pick.card) ? "defense"
            : "attack";
          me.field.push({ card: pick.card, position, summonedTurn: turn, attackedThisTurn: false });
          push({
            turn, side, type: "summon", card: pick.card.name, position,
            text: pick.card.link
              ? `Triệu hồi ${pick.card.name} (ATK ${effAtk(pick.card)} · Link Monster) ở thế công.`
              : `Triệu hồi ${pick.card.name} (ATK ${effAtk(pick.card)} / DEF ${effDef(pick.card)}) ở thế ${position === "attack" ? "công" : "thủ"}.`,
          });
        }
      }

      // ---- Position changes (not on the summon turn, once each) ----
      for (const m of me.field) {
        if (m.summonedTurn === turn) continue;
        if (m.card.link) continue; // Link Monsters never change position
        const foeBestAtk = Math.max(0, ...foe.field.filter((x) => x.position === "attack").map((x) => effAtk(x.card)));
        if (m.position === "defense" && effAtk(m.card) > foeBestAtk) {
          m.position = "attack";
          push({ turn, side, type: "position", card: m.card.name, position: "attack", text: `${m.card.name} chuyển sang thế công.` });
        } else if (m.position === "attack" && effAtk(m.card) < foeBestAtk && effDef(m.card) > effAtk(m.card)) {
          m.position = "defense";
          push({ turn, side, type: "position", card: m.card.name, position: "defense", text: `${m.card.name} chuyển sang thế thủ.` });
        }
      }

      // ---- Battle Phase ----
      const attackers = me.field
        .filter((m) => m.position === "attack")
        .sort((x, y) => effAtk(y.card) - effAtk(x.card));
      for (const atk of attackers) {
        if (winner) break;
        if (!me.field.includes(atk)) continue; // destroyed earlier this phase
        const atkVal = effAtk(atk.card);
        if (!foe.field.length) {
          push({ turn, side, type: "direct", card: atk.card.name, damage: atkVal, text: `${atk.card.name} tấn công trực tiếp!` });
          damage(other(side), atkVal, turn, `${atk.card.name} đánh trực tiếp`);
          atk.attackedThisTurn = true;
          continue;
        }
        // Pick a target this attacker can profitably hit.
        const targets = foe.field
          .map((t) => {
            const face = t.position === "attack" ? effAtk(t.card) : effDef(t.card);
            return { t, face, diff: atkVal - face };
          })
          .filter(({ diff }) => diff > 0)
          .sort((x, y) => {
            // Prefer attack-position kills (they also deal LP damage),
            // then the weakest face value.
            const ax = x.t.position === "attack" ? 0 : 1;
            const ay = y.t.position === "attack" ? 0 : 1;
            return ax - ay || x.face - y.face;
          });
        // Trading equal ATK only makes sense for a real threat —
        // a 300-ATK monster suiciding into its mirror just stalls.
        const equalAtkTarget = atkVal >= 1000 ? foe.field.find(
          (t) => t.position === "attack" && effAtk(t.card) === atkVal,
        ) : undefined;
        const chosen = targets[0]?.t ?? null;
        if (!chosen && !equalAtkTarget) continue; // no favorable attack
        const target = chosen ?? equalAtkTarget!;
        const face = target.position === "attack" ? effAtk(target.card) : effDef(target.card);
        push({
          turn, side, type: "attack", card: atk.card.name, target: target.card.name,
          text: `${atk.card.name} (ATK ${atkVal}) tấn công ${target.card.name} (${target.position === "attack" ? "ATK" : "DEF"} ${face}).`,
        });
        atk.attackedThisTurn = true;
        if (target.position === "attack") {
          if (atkVal > face) {
            destroy(other(side), target, turn);
            damage(other(side), atkVal - face, turn, `${target.card.name} bị phá huỷ`);
          } else if (atkVal === face) {
            destroy(other(side), target, turn);
            destroy(side, atk, turn);
          }
        } else {
          if (atkVal > face) {
            destroy(other(side), target, turn);
          } else if (atkVal < face) {
            damage(side, face - atkVal, turn, `${atk.card.name} bị bật lại bởi thế thủ`);
          }
        }
        if (sides.a.lp <= 0 || sides.b.lp <= 0) {
          winner = sides.a.lp <= 0 ? "b" : "a";
        }
      }

      // ---- End Phase ----
      for (const m of me.field) m.attackedThisTurn = false;
    }
  }

  if (!winner) {
    if (sides.a.lp !== sides.b.lp) winner = sides.a.lp > sides.b.lp ? "a" : "b";
    else {
      const sumA = sides.a.field.reduce((s, m) => s + effAtk(m.card), 0);
      const sumB = sides.b.field.reduce((s, m) => s + effAtk(m.card), 0);
      winner = sumA >= sumB ? "a" : "b";
    }
  }
  const [lpA, lpB] = lpPair();
  events.push({
    turn, side: winner, type: "win", lpA, lpB,
    text: winner === "a" ? "Duelist A thắng trận đấu!" : "Duelist B thắng trận đấu!",
  });

  return {
    winner,
    turns: turn,
    lp: [Math.max(0, sides.a.lp), Math.max(0, sides.b.lp)],
    events,
    fieldA: sides.a.field,
    fieldB: sides.b.field,
  };
}

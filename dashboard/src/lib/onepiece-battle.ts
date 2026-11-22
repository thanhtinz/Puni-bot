/**
 * One Piece Card Game engine (spec 6.39) — real-rules core, v1.
 *
 * Official turn structure per side: Refresh (rested cards stand,
 * attached DON!! return) → Draw 1 (the first player skips their
 * first draw) → DON phase (+2 DON!!, the first player only +1 on
 * turn 1, 10 max) → Main: play Characters by resting DON!! as cost,
 * attach DON!! for +1000 power each (your turn only), and attack
 * with the Leader and Characters (a Character cannot attack the
 * turn it is played unless it has [Rush]).
 * Battles follow the real steps: the defender may redirect the
 * attack by resting a [Blocker], then discard hand cards with
 * Counter values to raise the defending power. The attacker wins
 * only with strictly greater power: a Character that loses is
 * KO'd; a Leader that loses takes 1 Life damage (2 with
 * [Double Attack]) — the Life card goes to hand, or to trash with
 * [Banish]. A Leader at 0 Life loses to the next successful attack.
 * Deck-out also loses. Event/Stage cards and [On Play]/[Trigger]
 * effects are out of scope for v1 (decks are Characters only).
 * Deterministic per seed; emits an event stream for the arena.
 */

export interface OpCard {
  speciesId: string;
  name: string;
  cost: number;
  power: number;
  counter: number;
  blocker?: boolean;
  rush?: boolean;
  doubleAttack?: boolean;
  banish?: boolean;
  enhance?: number;
}

export interface OpLeader {
  speciesId: string;
  name: string;
  power: number;
  life: number;
}

export interface OpFieldCard {
  card: OpCard;
  rested: boolean;
  playedTurn: number;
  don: number;
}

export interface OpEvent {
  turn: number;
  side: "a" | "b";
  type:
    | "draw" | "don" | "play" | "attach" | "attack" | "block"
    | "counter" | "ko" | "life" | "deckout" | "win";
  card?: string;
  target?: string;
  amount?: number;
  powerA?: number;
  powerB?: number;
  lifeA: number;
  lifeB: number;
  text: string;
}

export interface OnePieceBattleResult {
  winner: "a" | "b";
  turns: number;
  life: [number, number];
  events: OpEvent[];
}

const MAX_TURNS = 40;
const FIELD_LIMIT = 5;
const DON_DECK = 10;

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

const effPower = (c: OpCard) => c.power + (c.enhance ?? 0) * 200;
const other = (s: "a" | "b"): "a" | "b" => (s === "a" ? "b" : "a");

interface Player {
  leader: OpLeader;
  deck: OpCard[];
  hand: OpCard[];
  life: OpCard[];
  field: OpFieldCard[];
  trash: OpCard[];
  donActive: number;
  donRested: number;
  donAttached: number;
  leaderRested: boolean;
  leaderDon: number;
}

function shuffled(cards: OpCard[], rng: () => number): OpCard[] {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function simulateOnePieceBattle(
  leaderA: OpLeader,
  deckA: OpCard[],
  leaderB: OpLeader,
  deckB: OpCard[],
  seed: string,
): OnePieceBattleResult {
  const rng = rngFromSeed(hashSeed(seed));
  const mk = (leader: OpLeader, deckIn: OpCard[]): Player => {
    const d = shuffled(deckIn, rng);
    return {
      leader,
      deck: d.slice(5 + leader.life),
      hand: d.slice(0, 5),
      life: d.slice(5, 5 + leader.life),
      field: [],
      trash: [],
      donActive: 0,
      donRested: 0,
      donAttached: 0,
      leaderRested: false,
      leaderDon: 0,
    };
  };
  const sides: Record<"a" | "b", Player> = { a: mk(leaderA, deckA), b: mk(leaderB, deckB) };
  const events: OpEvent[] = [];
  let winner: "a" | "b" | null = null;
  let turn = 0;

  const push = (e: Omit<OpEvent, "lifeA" | "lifeB">) =>
    events.push({ ...e, lifeA: sides.a.life.length, lifeB: sides.b.life.length });

  while (!winner && turn < MAX_TURNS) {
    turn += 1;
    for (const side of ["a", "b"] as const) {
      if (winner) break;
      const me = sides[side];
      const foe = sides[other(side)];
      const isFirstTurnOfGame = turn === 1 && side === "a";

      // ---- Refresh Phase ----
      for (const f of me.field) {
        f.rested = false;
        me.donAttached -= f.don;
        f.don = 0;
      }
      me.leaderRested = false;
      me.donAttached -= me.leaderDon;
      me.leaderDon = 0;
      me.donActive += me.donRested;
      me.donRested = 0;

      // ---- Draw Phase ----
      if (!isFirstTurnOfGame) {
        if (!me.deck.length) {
          push({ turn, side, type: "deckout", text: "Không còn bài để rút — thua vì deck out!" });
          winner = other(side);
          break;
        }
        me.hand.push(me.deck.shift()!);
        push({ turn, side, type: "draw", text: "Rút 1 lá." });
      }

      // ---- DON Phase ----
      const donGain = isFirstTurnOfGame ? 1 : 2;
      const total = me.donActive + me.donRested + me.donAttached;
      const gained = Math.min(donGain, DON_DECK - total);
      me.donActive += gained;
      if (gained > 0) {
        push({ turn, side, type: "don", amount: me.donActive + me.donRested + me.donAttached, text: `Nhận ${gained} DON!! (tổng ${me.donActive + me.donRested + me.donAttached}).` });
      }

      // ---- Main Phase: play Characters (strongest affordable first) ----
      let guard = 0;
      while (me.field.length < FIELD_LIMIT && guard++ < 12) {
        const playable = me.hand
          .filter((c) => c.cost <= me.donActive)
          .sort((x, y) => effPower(y) - effPower(x) || y.cost - x.cost);
        const pick = playable[0];
        if (!pick) break;
        me.hand.splice(me.hand.indexOf(pick), 1);
        me.donActive -= pick.cost;
        me.donRested += pick.cost;
        me.field.push({ card: pick, rested: false, playedTurn: turn, don: 0 });
        push({ turn, side, type: "play", card: pick.name, amount: pick.cost, text: `Ra sân ${pick.name} (Power ${effPower(pick)}, cost ${pick.cost}).` });
      }

      // ---- Attacks ----
      const canAttack = (f: OpFieldCard) =>
        !f.rested && (f.playedTurn < turn || f.card.rush);
      const attackers: Array<{ kind: "leader" } | { kind: "char"; f: OpFieldCard }> = [];
      if (!me.leaderRested && !isFirstTurnOfGame) attackers.push({ kind: "leader" });
      for (const f of me.field.filter(canAttack)) attackers.push({ kind: "char", f });

      for (const atk of attackers) {
        if (winner) break;
        const isLeader = atk.kind === "leader";
        const atkCard = isLeader ? null : (atk as { f: OpFieldCard }).f;
        if (atkCard && !me.field.includes(atkCard)) continue;
        const basePower = isLeader ? me.leader.power : effPower(atkCard!.card);
        // Attach all remaining active DON to this attacker.
        const attach = me.donActive;
        if (attach > 0) {
          me.donActive = 0;
          me.donAttached += attach;
          if (isLeader) me.leaderDon += attach; else atkCard!.don += attach;
          push({
            turn, side, type: "attach",
            card: isLeader ? me.leader.name : atkCard!.card.name, amount: attach,
            text: `Gắn ${attach} DON!! cho ${isLeader ? me.leader.name : atkCard!.card.name} (+${attach * 1000} Power).`,
          });
        }
        const atkPower = basePower + attach * 1000;

        // Target: a rested opposing Character this attacker beats,
        // otherwise the opposing Leader — but only when the attack
        // can actually win; a hopeless attack just rests the
        // attacker for nothing, so it is skipped entirely.
        const killable = foe.field
          .filter((f) => f.rested && effPower(f.card) < atkPower)
          .sort((x, y) => effPower(y.card) - effPower(x.card))[0];
        if (!killable && atkPower <= foe.leader.power) continue;
        let targetKind: "leader" | "char" = killable ? "char" : "leader";
        let targetField = killable ?? null;

        // Rest the attacker.
        if (isLeader) me.leaderRested = true; else atkCard!.rested = true;
        push({
          turn, side, type: "attack",
          card: isLeader ? me.leader.name : atkCard!.card.name,
          target: targetKind === "leader" ? foe.leader.name : targetField!.card.name,
          powerA: atkPower,
          text: `${isLeader ? me.leader.name : atkCard!.card.name} (Power ${atkPower}) tấn công ${targetKind === "leader" ? `Leader ${foe.leader.name}` : targetField!.card.name}!`,
        });

        // ---- Blocker step ----
        {
          const blocker = foe.field.find(
            (f) => !f.rested && f.card.blocker && f !== targetField,
          );
          const worthBlocking =
            blocker &&
            ((targetKind === "leader" && foe.life.length <= 2) ||
              (targetKind === "char" && targetField && effPower(targetField.card) >= 6000));
          if (blocker && worthBlocking) {
            blocker.rested = true;
            targetKind = "char";
            targetField = blocker;
            push({ turn, side: other(side), type: "block", card: blocker.card.name, text: `${blocker.card.name} [Blocker] chắn đòn, chuyển mục tiêu!` });
          }
        }

        // ---- Counter step ----
        let defPower = targetKind === "leader" ? foe.leader.power : effPower(targetField!.card);
        if (atkPower > defPower) {
          const savingLeader = targetKind === "leader";
          const savingBigChar = targetKind === "char" && effPower(targetField!.card) >= 6000;
          if (savingLeader || savingBigChar) {
            const counters = foe.hand
              .filter((c) => c.counter > 0)
              .sort((x, y) => x.counter - y.counter);
            let added = 0;
            const used: OpCard[] = [];
            for (const c of counters) {
              if (defPower + added > atkPower) break;
              added += c.counter;
              used.push(c);
            }
            if (added > 0 && defPower + added > atkPower) {
              for (const c of used) {
                foe.hand.splice(foe.hand.indexOf(c), 1);
                foe.trash.push(c);
              }
              defPower += added;
              push({
                turn, side: other(side), type: "counter", amount: added,
                text: `Counter +${added} Power bằng ${used.map((c) => c.name).join(", ")}.`,
              });
            }
          }
        }

        // ---- Damage step ----
        if (atkPower > defPower) {
          if (targetKind === "char" && targetField) {
            foe.field = foe.field.filter((f) => f !== targetField);
            foe.trash.push(targetField.card);
            foe.donAttached -= targetField.don;
            push({ turn, side: other(side), type: "ko", card: targetField.card.name, powerA: atkPower, powerB: defPower, text: `${targetField.card.name} bị KO! (${atkPower} > ${defPower})` });
          } else {
            // Leader takes damage.
            if (!foe.life.length) {
              winner = side;
              push({ turn, side, type: "life", card: foe.leader.name, text: `Đòn quyết định lên Leader ${foe.leader.name} khi Life đã cạn!` });
              break;
            }
            const hits = !isLeader && atkCard!.card.doubleAttack ? 2 : 1;
            const banish = !isLeader && !!atkCard!.card.banish;
            for (let h = 0; h < hits && foe.life.length; h++) {
              const lifeCard = foe.life.shift()!;
              if (banish) foe.trash.push(lifeCard); else foe.hand.push(lifeCard);
              push({
                turn, side: other(side), type: "life", card: foe.leader.name, amount: foe.life.length,
                text: `Leader ${foe.leader.name} mất 1 Life (còn ${foe.life.length})${banish ? " — lá Life vào trash vì [Banish]" : " — lá Life lên tay"}.`,
              });
            }
            if (!foe.life.length) {
              // One more successful attack is still required by the
              // rules; the loop continues and will end it.
            }
          }
        }
      }
    }
  }

  if (!winner) {
    if (sides.a.life.length !== sides.b.life.length) {
      winner = sides.a.life.length > sides.b.life.length ? "a" : "b";
    } else {
      const sum = (p: Player) => p.field.reduce((s, f) => s + effPower(f.card), 0) + p.leader.power;
      winner = sum(sides.a) >= sum(sides.b) ? "a" : "b";
    }
  }
  events.push({
    turn, side: winner, type: "win",
    lifeA: sides.a.life.length, lifeB: sides.b.life.length,
    text: winner === "a" ? "Người chơi A thắng trận đấu!" : "Người chơi B thắng trận đấu!",
  });
  return { winner, turns: turn, life: [sides.a.life.length, sides.b.life.length], events };
}

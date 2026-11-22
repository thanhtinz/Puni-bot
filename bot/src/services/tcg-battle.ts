/**
 * TCG card battle engine (spec 6.24) — pure and deterministic given
 * the injected RNG. Two teams of up to 5 cards fight round by round:
 * every living card acts once per round in team order, dealing damage
 * scaled by its attack with a small random spread; every 3rd action
 * of a card is a charged "special" hit at 1.6x. A card faints at 0 HP;
 * the battle ends when one side has no living cards (or the round cap
 * is hit, when the side with more total HP left wins).
 */

export interface BattleCardInput {
  code: string;
  name: string;
  speciesId: string;
  maxHp: number;
  atk: number;
}

export interface BattleCardState extends BattleCardInput {
  hp: number;
  actions: number;
}

export interface BattleResult {
  winner: "a" | "b";
  rounds: number;
  log: string[];
  survivorsA: string[];
  survivorsB: string[];
}

const MAX_ROUNDS = 40;

export function simulateCardBattle(
  teamA: BattleCardInput[],
  teamB: BattleCardInput[],
  rng: () => number,
): BattleResult {
  const a: BattleCardState[] = teamA.map((c) => ({ ...c, hp: c.maxHp, actions: 0 }));
  const b: BattleCardState[] = teamB.map((c) => ({ ...c, hp: c.maxHp, actions: 0 }));
  const log: string[] = [];
  const living = (team: BattleCardState[]) => team.filter((c) => c.hp > 0);
  let rounds = 0;

  const strike = (att: BattleCardState, foes: BattleCardState[], side: string) => {
    const targets = living(foes);
    if (!targets.length) return;
    const target = targets[Math.floor(rng() * targets.length)];
    att.actions += 1;
    const special = att.actions % 3 === 0;
    const spread = 0.85 + rng() * 0.3;
    const dmg = Math.max(1, Math.round(att.atk * spread * (special ? 1.6 : 1)));
    target.hp = Math.max(0, target.hp - dmg);
    log.push(
      `${side} ${att.name} ${special ? "ra đòn mạnh vào" : "đánh"} ${target.name}: −${dmg} HP` +
        (target.hp <= 0 ? ` — ${target.name} gục!` : ` (còn ${target.hp}/${target.maxHp})`),
    );
  };

  while (living(a).length && living(b).length && rounds < MAX_ROUNDS) {
    rounds += 1;
    for (const card of a) {
      if (card.hp > 0 && living(b).length) strike(card, b, "🔹");
    }
    for (const card of b) {
      if (card.hp > 0 && living(a).length) strike(card, a, "🔸");
    }
  }

  let winner: "a" | "b";
  if (living(a).length && !living(b).length) winner = "a";
  else if (living(b).length && !living(a).length) winner = "b";
  else {
    const hpA = a.reduce((s, c) => s + c.hp, 0);
    const hpB = b.reduce((s, c) => s + c.hp, 0);
    winner = hpA >= hpB ? "a" : "b";
  }
  return {
    winner,
    rounds,
    log,
    survivorsA: living(a).map((c) => c.code),
    survivorsB: living(b).map((c) => c.code),
  };
}

/** Battle stats for one owned card instance from its species base stats. */
export function battleStatsFor(
  baseHp: number,
  baseAtk: number,
  level: number,
  enhance: number,
): { maxHp: number; atk: number } {
  const lvlMult = 1 + Math.max(0, level - 1) * 0.05;
  return {
    maxHp: Math.round(baseHp * 6 * lvlMult + enhance * 25),
    atk: Math.round(baseAtk * lvlMult + enhance * 3),
  };
}

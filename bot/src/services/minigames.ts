/**
 * Minigame engines (spec 6.16) — pure and deterministic given an rng,
 * so every game is unit-testable and replayable.
 */

export type Rng = () => number;

/* ---------------- Blackjack ---------------- */

export interface BjCard { rank: string; suit: string; value: number }

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

export function drawCard(rng: Rng): BjCard {
  const rank = RANKS[Math.floor(rng() * RANKS.length)];
  const suit = SUITS[Math.floor(rng() * SUITS.length)];
  const value = rank === "A" ? 11 : ["J", "Q", "K"].includes(rank) ? 10 : Number.parseInt(rank, 10);
  return { rank, suit, value };
}

/** Best blackjack total: aces count 11 unless that busts. */
export function handValue(hand: BjCard[]): number {
  let total = hand.reduce((s, c) => s + c.value, 0);
  let aces = hand.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

export function formatHand(hand: BjCard[], hideFirst = false): string {
  return hand
    .map((c, i) => (hideFirst && i === 0 ? "🂠" : `${c.rank}${c.suit}`))
    .join(" ");
}

export interface BjState {
  bet: number;
  player: BjCard[];
  dealer: BjCard[];
  phase: "playing" | "done";
  result?: "blackjack" | "win" | "lose" | "push" | "bust";
  payout?: number;
}

export function bjStart(bet: number, rng: Rng): BjState {
  const state: BjState = {
    bet,
    player: [drawCard(rng), drawCard(rng)],
    dealer: [drawCard(rng), drawCard(rng)],
    phase: "playing",
  };
  if (handValue(state.player) === 21) {
    state.phase = "done";
    if (handValue(state.dealer) === 21) { state.result = "push"; state.payout = bet; }
    else { state.result = "blackjack"; state.payout = Math.floor(bet * 2.5); }
  }
  return state;
}

/** Dealer plays out: hits below 17, stands on all 17s. */
export function bjDealerPlay(state: BjState, rng: Rng): void {
  while (handValue(state.dealer) < 17) state.dealer.push(drawCard(rng));
  const pv = handValue(state.player);
  const dv = handValue(state.dealer);
  state.phase = "done";
  if (dv > 21 || pv > dv) { state.result = "win"; state.payout = state.bet * 2; }
  else if (pv < dv) { state.result = "lose"; state.payout = 0; }
  else { state.result = "push"; state.payout = state.bet; }
}

export function bjHit(state: BjState, rng: Rng): BjState {
  if (state.phase !== "playing") return state;
  state.player.push(drawCard(rng));
  const pv = handValue(state.player);
  if (pv > 21) { state.phase = "done"; state.result = "bust"; state.payout = 0; }
  else if (pv === 21) bjDealerPlay(state, rng);
  return state;
}

export function bjStand(state: BjState, rng: Rng): BjState {
  if (state.phase !== "playing") return state;
  bjDealerPlay(state, rng);
  return state;
}

/* ---------------- Tic-tac-toe ---------------- */

export type TttCell = "X" | "O" | "";
export type TttDifficulty = "easy" | "medium" | "hard";

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function tttWinner(board: TttCell[]): "X" | "O" | "draw" | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a] as "X" | "O";
  }
  return board.every((c) => c !== "") ? "draw" : null;
}

function winningMove(board: TttCell[], mark: "X" | "O"): number | null {
  for (const line of LINES) {
    const cells = line.map((i) => board[i]);
    if (cells.filter((c) => c === mark).length === 2 && cells.includes("")) {
      return line[cells.indexOf("")];
    }
  }
  return null;
}

function minimax(board: TttCell[], isMax: boolean, mark: "X" | "O", foe: "X" | "O", depth: number): number {
  const w = tttWinner(board);
  if (w === mark) return 10 - depth;
  if (w === foe) return depth - 10;
  if (w === "draw") return 0;
  let best = isMax ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== "") continue;
    board[i] = isMax ? mark : foe;
    const score = minimax(board, !isMax, mark, foe, depth + 1);
    board[i] = "";
    best = isMax ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

export function tttBotMove(board: TttCell[], difficulty: TttDifficulty, rng: Rng): number {
  const empty = board.map((c, i) => (c === "" ? i : -1)).filter((i) => i >= 0);
  if (!empty.length) return -1;
  const randomPick = () => empty[Math.floor(rng() * empty.length)];
  if (difficulty === "easy") return randomPick();
  const win = winningMove(board, "O");
  if (win !== null) return win;
  const block = winningMove(board, "X");
  if (difficulty === "medium") {
    if (block !== null) return block;
    return randomPick();
  }
  // hard: minimax (also takes the win above via search anyway)
  let bestScore = -Infinity;
  let bestMove = empty[0];
  for (const i of empty) {
    board[i] = "O";
    const score = minimax(board, false, "O", "X", 0);
    board[i] = "";
    if (score > bestScore) { bestScore = score; bestMove = i; }
  }
  return bestMove;
}

export function formatBoard(board: TttCell[]): string {
  const cell = (i: number) => (board[i] === "" ? `${i + 1}` : board[i] === "X" ? "❌" : "⭕");
  return [0, 1, 2].map((r) => [0, 1, 2].map((c) => cell(r * 3 + c)).join(" ")).join("\n");
}

/* ---------------- Animal race (đua thú) ---------------- */

export interface Animal { id: string; name: string; emoji: string; odds: number; speed: number }

export const ANIMALS: Animal[] = [
  { id: "ngua", name: "Ngựa", emoji: "🐴", odds: 1.9, speed: 5 },
  { id: "tho", name: "Thỏ", emoji: "🐰", odds: 2.2, speed: 4.4 },
  { id: "cho", name: "Chó", emoji: "🐶", odds: 2.4, speed: 4.1 },
  { id: "meo", name: "Mèo", emoji: "🐱", odds: 2.8, speed: 3.7 },
  { id: "rua", name: "Rùa", emoji: "🐢", odds: 4.5, speed: 2.4 },
];

export const RACE_DISTANCE = 20;

export interface RaceResult {
  winner: Animal;
  /** Position snapshot per tick, aligned with ANIMALS order. */
  ticks: number[][];
}

export function simulateRace(rng: Rng): RaceResult {
  const pos = ANIMALS.map(() => 0);
  const ticks: number[][] = [];
  for (let t = 0; t < 60; t++) {
    ANIMALS.forEach((a, i) => {
      pos[i] += Math.floor(rng() * (a.speed + 1));
    });
    ticks.push([...pos]);
    const done = pos.findIndex((p) => p >= RACE_DISTANCE);
    if (done >= 0) return { winner: ANIMALS[done], ticks };
  }
  const max = Math.max(...pos);
  return { winner: ANIMALS[pos.indexOf(max)], ticks };
}

export function formatRace(result: RaceResult): string {
  const lines: string[] = [];
  const shown = result.ticks.filter((_, i) => i % 2 === 0 || i === result.ticks.length - 1);
  for (const tick of shown.slice(-6)) {
    lines.push(
      ANIMALS.map((a, i) => {
        const filled = Math.min(RACE_DISTANCE, tick[i]);
        return `${a.emoji} ${"▓".repeat(filled)}${"░".repeat(RACE_DISTANCE - filled)}`;
      }).join("\n"),
    );
  }
  return lines.join("\n┄┄┄\n");
}

/**
 * PostgreSQL store for the TCG social systems (spec 6.38): auctions,
 * showcases, tournaments — the same tables the dashboard uses. All
 * state transitions that matter (settle claims, bid application,
 * bracket locking, match results) are single guarded statements or
 * short transactions so two surfaces can never settle twice.
 */
import type { Pool } from "pg";
import { rngFromSeed } from "../services/tcg-formats";
import {
  TOURNAMENT_WINDOW_MS, totalRounds,
  type AuctionRow, type EntryRow, type MatchRow, type ShowcaseRow,
  type SocialStore, type TournamentRow,
} from "../services/tcg-social";

type Row = Record<string, unknown>;
const num = (v: unknown) => (v == null ? 0 : Number(v));
const date = (v: unknown) => (v instanceof Date ? v : new Date(String(v)));

function mapAuction(r: Row): AuctionRow {
  return {
    id: Number(r.id), sellerId: String(r.seller_id), instanceCode: String(r.instance_code),
    startPrice: num(r.start_price), currentPrice: r.current_price == null ? null : num(r.current_price),
    topBidder: r.top_bidder == null ? null : String(r.top_bidder),
    buyNowPrice: r.buy_now_price == null ? null : num(r.buy_now_price),
    endsAt: date(r.ends_at), status: String(r.status), createdAt: date(r.created_at),
  };
}

function mapTournament(r: Row): TournamentRow {
  return {
    id: Number(r.id), name: String(r.name), size: Number(r.size),
    entryFee: num(r.entry_fee), rakePercent: num(r.rake_percent),
    prizeFirst: num(r.prize_first), prizeSecond: num(r.prize_second), prizeSemis: num(r.prize_semis),
    status: String(r.status), createdBy: String(r.created_by),
    championId: r.champion_id == null ? null : String(r.champion_id),
    edition: r.edition === "jp" ? "jp" : r.edition === "en" ? "en" : null,
  };
}

function mapMatch(r: Row): MatchRow {
  return {
    id: Number(r.id), tournamentId: Number(r.tournament_id),
    round: Number(r.round), slot: Number(r.slot),
    p1Id: r.p1_id == null ? null : String(r.p1_id),
    p2Id: r.p2_id == null ? null : String(r.p2_id),
    p1In: Boolean(r.p1_in), p2In: Boolean(r.p2_in),
    readyAt: r.ready_at == null ? null : date(r.ready_at),
    winnerId: r.winner_id == null ? null : String(r.winner_id),
    result: r.result == null ? null : String(r.result),
  };
}

const AUCTION_COLS = `id, seller_id, instance_code, start_price::text AS start_price,
  current_price::text AS current_price, top_bidder, buy_now_price::text AS buy_now_price,
  ends_at, status, created_at`;
const TOURNEY_COLS = `id, name, size, entry_fee::text AS entry_fee, rake_percent::text AS rake_percent,
  prize_first::text AS prize_first, prize_second::text AS prize_second,
  prize_semis::text AS prize_semis, status, created_by, champion_id, edition`;
const MATCH_COLS = `id, tournament_id, round, slot, p1_id, p2_id, p1_in, p2_in, ready_at, winner_id, result`;
const MATCH_COLS_M = `m.id, m.tournament_id, m.round, m.slot, m.p1_id, m.p2_id, m.p1_in, m.p2_in, m.ready_at, m.winner_id, m.result`;

export class PgSocialStore implements SocialStore {
  constructor(private pool: Pool) {}

  // ---------------- Auctions ----------------

  async dueAuctions(now: Date) {
    const res = await this.pool.query(
      `SELECT ${AUCTION_COLS} FROM tcg_auctions WHERE status = 'open' AND ends_at <= $1 ORDER BY ends_at LIMIT 50`,
      [now],
    );
    return (res.rows as Row[]).map(mapAuction);
  }

  async claimAuctionSettle(id: number, status: "sold" | "unsold") {
    const res = await this.pool.query(
      `UPDATE tcg_auctions SET status = $2, settled_at = now() WHERE id = $1 AND status = 'open'
       RETURNING ${AUCTION_COLS}`,
      [id, status],
    );
    return res.rows[0] ? mapAuction(res.rows[0] as Row) : null;
  }

  async getAuction(id: number) {
    const res = await this.pool.query(`SELECT ${AUCTION_COLS} FROM tcg_auctions WHERE id = $1`, [id]);
    return res.rows[0] ? mapAuction(res.rows[0] as Row) : null;
  }

  async listOpenAuctions() {
    const res = await this.pool.query(
      `SELECT ${AUCTION_COLS} FROM tcg_auctions WHERE status = 'open' ORDER BY ends_at ASC LIMIT 60`,
    );
    return (res.rows as Row[]).map(mapAuction);
  }

  async auctionsOf(sellerId: string) {
    const res = await this.pool.query(
      `SELECT ${AUCTION_COLS} FROM tcg_auctions WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [sellerId],
    );
    return (res.rows as Row[]).map(mapAuction);
  }

  async bidAuctionIds(userId: string) {
    const res = await this.pool.query(
      `SELECT DISTINCT auction_id FROM tcg_auction_bids WHERE bidder_id = $1`, [userId],
    );
    return (res.rows as Row[]).map((r) => Number(r.auction_id));
  }

  async auctionsBidOn(userId: string) {
    const res = await this.pool.query(
      `SELECT ${AUCTION_COLS} FROM tcg_auctions
       WHERE id IN (SELECT DISTINCT auction_id FROM tcg_auction_bids WHERE bidder_id = $1)
       ORDER BY ends_at ASC LIMIT 30`,
      [userId],
    );
    return (res.rows as Row[]).map(mapAuction);
  }

  async insertAuction(a: Omit<AuctionRow, "id" | "status" | "createdAt" | "currentPrice" | "topBidder">) {
    const res = await this.pool.query(
      `INSERT INTO tcg_auctions (seller_id, instance_code, start_price, buy_now_price, ends_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${AUCTION_COLS}`,
      [a.sellerId, a.instanceCode, a.startPrice, a.buyNowPrice, a.endsAt],
    );
    return mapAuction(res.rows[0] as Row);
  }

  async applyBid(id: number, prevTop: string | null, prevPrice: number | null, bidder: string, amount: number, newEndsAt: Date | null) {
    const res = await this.pool.query(
      `UPDATE tcg_auctions SET current_price = $4, top_bidder = $5,
              ends_at = COALESCE($6, ends_at)
       WHERE id = $1 AND status = 'open'
         AND top_bidder IS NOT DISTINCT FROM $2
         AND current_price IS NOT DISTINCT FROM $3`,
      [id, prevTop, prevPrice, amount, bidder, newEndsAt],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async addBidRecord(auctionId: number, bidder: string, amount: number) {
    await this.pool.query(
      `INSERT INTO tcg_auction_bids (auction_id, bidder_id, amount) VALUES ($1, $2, $3)`,
      [auctionId, bidder, amount],
    );
  }

  async countBids(auctionId: number) {
    const res = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM tcg_auction_bids WHERE auction_id = $1`, [auctionId],
    );
    return Number((res.rows[0] as Row).n ?? 0);
  }

  async claimAuctionSold(id: number, winnerId: string, price: number) {
    const res = await this.pool.query(
      `UPDATE tcg_auctions SET status = 'sold', settled_at = now(), current_price = $3, top_bidder = $2
       WHERE id = $1 AND status = 'open' RETURNING ${AUCTION_COLS}`,
      [id, winnerId, price],
    );
    return res.rows[0] ? mapAuction(res.rows[0] as Row) : null;
  }

  async cancelAuctionRow(id: number, sellerId: string) {
    const res = await this.pool.query(
      `UPDATE tcg_auctions SET status = 'cancelled', settled_at = now()
       WHERE id = $1 AND seller_id = $2 AND status = 'open' AND top_bidder IS NULL`,
      [id, sellerId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // ---------------- Showcase ----------------

  async getShowcaseRow(userId: string) {
    const res = await this.pool.query(
      `SELECT user_id, owned, is_public, layout, theme, effect, pins FROM tcg_showcases WHERE user_id = $1`,
      [userId],
    );
    const r = res.rows[0] as Row | undefined;
    if (!r) return null;
    const row: ShowcaseRow = {
      userId: String(r.user_id), owned: Boolean(r.owned), isPublic: Boolean(r.is_public),
      layout: String(r.layout), theme: String(r.theme), effect: String(r.effect),
      pins: (r.pins as string[]) ?? [],
    };
    return row;
  }

  // ---------------- Tournaments ----------------

  async listTournaments() {
    const res = await this.pool.query(
      `SELECT ${TOURNEY_COLS} FROM tcg_tournaments ORDER BY id DESC LIMIT 30`,
    );
    return (res.rows as Row[]).map(mapTournament);
  }

  async getTournament(id: number) {
    const res = await this.pool.query(`SELECT ${TOURNEY_COLS} FROM tcg_tournaments WHERE id = $1`, [id]);
    return res.rows[0] ? mapTournament(res.rows[0] as Row) : null;
  }

  async insertTournament(t: Omit<TournamentRow, "id" | "status" | "championId">) {
    const res = await this.pool.query(
      `INSERT INTO tcg_tournaments (name, size, entry_fee, rake_percent, prize_first, prize_second, prize_semis, created_by, edition)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${TOURNEY_COLS}`,
      [t.name, t.size, t.entryFee, t.rakePercent, t.prizeFirst, t.prizeSecond, t.prizeSemis, t.createdBy, t.edition],
    );
    return mapTournament(res.rows[0] as Row);
  }

  async setTournamentEdition(id: number, edition: "en" | "jp") {
    const res = await this.pool.query(
      `UPDATE tcg_tournaments SET edition = $2 WHERE id = $1 AND edition IS NULL`,
      [id, edition],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async removeEntry(tournamentId: number, userId: string) {
    await this.pool.query(
      `DELETE FROM tcg_tournament_entries WHERE tournament_id = $1 AND user_id = $2`,
      [tournamentId, userId],
    );
  }

  async listEntries(tournamentId: number) {
    const res = await this.pool.query(
      `SELECT user_id, seed, deck_codes FROM tcg_tournament_entries WHERE tournament_id = $1 ORDER BY joined_at, user_id`,
      [tournamentId],
    );
    return (res.rows as Row[]).map((r): EntryRow => ({
      userId: String(r.user_id),
      seed: r.seed == null ? null : Number(r.seed),
      deckCodes: (r.deck_codes as string[]) ?? [],
    }));
  }

  async insertEntryGuarded(tournamentId: number, userId: string, codes: string[], size: number) {
    const res = await this.pool.query(
      `INSERT INTO tcg_tournament_entries (tournament_id, user_id, deck_codes)
       SELECT $1, $2, $3 WHERE
         (SELECT COUNT(*) FROM tcg_tournament_entries WHERE tournament_id = $1) < $4
         AND NOT EXISTS (SELECT 1 FROM tcg_tournament_entries WHERE tournament_id = $1 AND user_id = $2)`,
      [tournamentId, userId, codes, size],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async lockBracket(tournamentId: number) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const tRes = await client.query(
        `SELECT ${TOURNEY_COLS} FROM tcg_tournaments WHERE id = $1 FOR UPDATE`, [tournamentId],
      );
      const t = tRes.rows[0] ? mapTournament(tRes.rows[0] as Row) : null;
      if (!t || t.status !== "open") {
        await client.query("ROLLBACK");
        return false;
      }
      const eRes = await client.query(
        `SELECT user_id FROM tcg_tournament_entries WHERE tournament_id = $1 ORDER BY joined_at, user_id`,
        [tournamentId],
      );
      const ids = (eRes.rows as Row[]).map((r) => String(r.user_id));
      if (ids.length !== t.size) {
        await client.query("ROLLBACK");
        return false;
      }
      const rng = rngFromSeed(t.id * 7919 + 13);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      for (let i = 0; i < ids.length; i++) {
        await client.query(
          `UPDATE tcg_tournament_entries SET seed = $1 WHERE tournament_id = $2 AND user_id = $3`,
          [i + 1, tournamentId, ids[i]],
        );
      }
      for (let slot = 0; slot < t.size / 2; slot++) {
        await client.query(
          `INSERT INTO tcg_tournament_matches (tournament_id, round, slot, p1_id, p2_id, ready_at)
           VALUES ($1, 1, $2, $3, $4, now())`,
          [tournamentId, slot, ids[slot], ids[t.size - 1 - slot]],
        );
      }
      await client.query(
        `UPDATE tcg_tournaments SET status = 'running', started_at = now() WHERE id = $1`,
        [tournamentId],
      );
      await client.query("COMMIT");
      return true;
    } catch {
      await client.query("ROLLBACK").catch(() => undefined);
      return false;
    } finally {
      client.release();
    }
  }

  async listMatches(tournamentId: number) {
    const res = await this.pool.query(
      `SELECT ${MATCH_COLS} FROM tcg_tournament_matches WHERE tournament_id = $1 ORDER BY round, slot`,
      [tournamentId],
    );
    return (res.rows as Row[]).map(mapMatch);
  }

  async getMatch(id: number) {
    const res = await this.pool.query(`SELECT ${MATCH_COLS} FROM tcg_tournament_matches WHERE id = $1`, [id]);
    return res.rows[0] ? mapMatch(res.rows[0] as Row) : null;
  }

  async matchesOfUser(userId: string) {
    const res = await this.pool.query(
      `SELECT ${MATCH_COLS_M} FROM tcg_tournament_matches m
       JOIN tcg_tournaments t ON t.id = m.tournament_id
       WHERE t.status = 'running' AND m.winner_id IS NULL AND (m.p1_id = $1 OR m.p2_id = $1)
       ORDER BY m.id`,
      [userId],
    );
    return (res.rows as Row[]).map(mapMatch);
  }

  async dueMatches(now: Date) {
    const res = await this.pool.query(
      `SELECT ${MATCH_COLS_M} FROM tcg_tournament_matches m
       JOIN tcg_tournaments t ON t.id = m.tournament_id
       WHERE t.status = 'running' AND m.winner_id IS NULL
         AND m.p1_id IS NOT NULL AND m.p2_id IS NOT NULL AND m.ready_at IS NOT NULL
         AND m.ready_at < $1::timestamptz - ($2 || ' milliseconds')::interval
       ORDER BY m.ready_at LIMIT 50`,
      [now, String(TOURNAMENT_WINDOW_MS)],
    );
    return (res.rows as Row[]).map(mapMatch);
  }

  async setMatchCheckin(matchId: number, col: "p1" | "p2") {
    const res = await this.pool.query(
      `UPDATE tcg_tournament_matches SET ${col === "p1" ? "p1_in" : "p2_in"} = TRUE WHERE id = $1
       RETURNING ${MATCH_COLS}`,
      [matchId],
    );
    return res.rows[0] ? mapMatch(res.rows[0] as Row) : null;
  }

  async recordMatchResult(matchId: number, winnerId: string, result: string, log: string[]) {
    const res = await this.pool.query(
      `UPDATE tcg_tournament_matches SET winner_id = $2, result = $3, log = $4::jsonb, played_at = now()
       WHERE id = $1 AND winner_id IS NULL`,
      [matchId, winnerId, result, JSON.stringify(log)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async advanceWinner(match: MatchRow, winnerId: string) {
    const t = await this.getTournament(match.tournamentId);
    if (!t) return "final" as const;
    const rounds = totalRounds(t.size);
    if (match.round >= rounds) return "final" as const;
    const nextSlot = Math.floor(match.slot / 2);
    const col = match.slot % 2 === 0 ? "p1_id" : "p2_id";
    await this.pool.query(
      `INSERT INTO tcg_tournament_matches (tournament_id, round, slot, ${col})
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tournament_id, round, slot) DO UPDATE SET ${col} = EXCLUDED.${col}`,
      [match.tournamentId, match.round + 1, nextSlot, winnerId],
    );
    await this.pool.query(
      `UPDATE tcg_tournament_matches SET ready_at = now()
       WHERE tournament_id = $1 AND round = $2 AND slot = $3
         AND p1_id IS NOT NULL AND p2_id IS NOT NULL AND ready_at IS NULL`,
      [match.tournamentId, match.round + 1, nextSlot],
    );
    return "advanced" as const;
  }

  async finishTournament(id: number, championId: string) {
    await this.pool.query(
      `UPDATE tcg_tournaments SET status = 'done', champion_id = $2, finished_at = now() WHERE id = $1`,
      [id, championId],
    );
  }
}

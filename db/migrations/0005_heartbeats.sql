-- Shard/cluster heartbeats (spec 2.5): each shard process refreshes
-- its row every few seconds; the dashboard /status page and the owner
-- admin panel read this table to show live fleet health. A row whose
-- updated_at is stale means that shard/cluster is down.
CREATE TABLE IF NOT EXISTS shard_heartbeats (
  cluster_id  TEXT NOT NULL,
  shard_id    INTEGER NOT NULL,
  guild_count INTEGER NOT NULL DEFAULT 0,
  ping_ms     INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cluster_id, shard_id)
);

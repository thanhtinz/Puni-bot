#!/bin/bash
# Rebuild the throwaway Puni test PostgreSQL (port 5434) from scratch.
set -e
rm -rf /tmp/pgbin /tmp/puni-pg-data
cp -r ~/workspace/tools/pg/dist /tmp/pgbin
chmod -R a+rX /tmp/pgbin
mkdir -p /tmp/puni-pg-data && chown nobody:nogroup /tmp/puni-pg-data 2>/dev/null || chown nobody /tmp/puni-pg-data
su nobody -s /bin/bash -c "/tmp/pgbin/bin/initdb -D /tmp/puni-pg-data -U postgres --auth=trust" > /tmp/pg-init.log 2>&1
su nobody -s /bin/bash -c "/tmp/pgbin/bin/pg_ctl -D /tmp/puni-pg-data -o '-p 5434 -k /tmp -h 127.0.0.1' -l /tmp/pg.log start"
sleep 1
cd ~/workspace/puni-bot-repo/bot
node -e "
const { Client } = require('pg');
(async () => {
  const c = new Client('postgres://postgres@127.0.0.1:5434/postgres');
  await c.connect();
  await c.query('CREATE DATABASE puni_test');
  await c.end();
  console.log('db puni_test created');
})();
"
DATABASE_URL=postgres://postgres@127.0.0.1:5434/puni_test npx tsx src/db/migrate.ts
echo PG-UP

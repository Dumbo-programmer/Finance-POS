import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import pg from 'pg';
import { config } from '../config.js';
import { schema } from './schema.js';
import { seed } from './seed.js';

let kind = config.dbClient;
let sqlite;
let pool;
let adapter;
let queue = Promise.resolve();

function serial(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

function createSqliteAdapter(database) {
  return {
    kind: 'sqlite',
    async all(sql, params = []) {
      return database.prepare(sql).all(...params);
    },
    async get(sql, params = []) {
      return database.prepare(sql).get(...params);
    },
    async run(sql, params = []) {
      return database.prepare(sql).run(...params);
    },
    async tx(fn) {
      return serial(async () => {
        database.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(adapter);
          database.exec('COMMIT');
          return result;
        } catch (error) {
          try { database.exec('ROLLBACK'); } catch { /* ignore */ }
          throw error;
        }
      });
    },
  };
}

function openSqlite(dbPath) {
  const database = new Database(dbPath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  return database;
}

function placeholder(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function createPgRunner(runner, txKind = 'pg') {
  return {
    kind: txKind,
    async all(sql, params = []) {
      const result = await runner.query(placeholder(sql), params);
      return result.rows;
    },
    async get(sql, params = []) {
      const result = await runner.query(placeholder(sql), params);
      return result.rows[0];
    },
    async run(sql, params = []) {
      return runner.query(placeholder(sql), params);
    },
  };
}

function createPgAdapter() {
  const base = createPgRunner(pool);
  return {
    ...base,
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx = createPgRunner(client, 'pg');
        const result = await fn(tx);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

async function migrate(database) {
  for (const statement of schema) {
    await database.run(statement);
  }
  await database.run(
    `INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    ['schema_version', '2']
  );
}

export async function initDb() {
  if (kind === 'pg') {
    if (!config.databaseUrl) throw new Error('DATABASE_URL is required when DB_CLIENT=pg');
    pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
    await pool.query('SELECT 1');
    adapter = createPgAdapter();
  } else {
    kind = 'sqlite';
    const dbPath = path.resolve(process.cwd(), config.sqlitePath);
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    sqlite = openSqlite(dbPath);

    // Guard against a legacy baseline database: schema v2 renamed monetary
    // columns to *_cents, so an old file cannot be migrated in place.
    const hasLegacyTransactions =
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'transactions'").get() &&
      !sqlite.prepare('PRAGMA table_info(transactions)').all().some((column) => column.name === 'total_cents');
    if (hasLegacyTransactions) {
      sqlite.close();
      for (const suffix of ['', '-wal', '-shm']) {
        fs.rmSync(`${dbPath}${suffix}`, { force: true });
      }
      sqlite = openSqlite(dbPath);
    }

    adapter = createSqliteAdapter(sqlite);
  }
  await migrate(adapter);
  await seed(adapter);
  return adapter;
}

export const db = {
  get kind() { return adapter?.kind || kind; },
  all(sql, params) { return adapter.all(sql, params); },
  get(sql, params) { return adapter.get(sql, params); },
  run(sql, params) { return adapter.run(sql, params); },
  tx(fn) { return adapter.tx(fn); },
};

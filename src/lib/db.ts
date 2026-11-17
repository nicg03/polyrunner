import "server-only";
import pg from "pg";

// numeric/bigint come number e timestamp come stringa ISO, così i dati passano
// direttamente ai Client Component.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, parseFloat);
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => parseInt(v, 10));
// Formato Postgres "2026-11-17 18:51:42.123+00" -> ISO 8601.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) =>
  new Date(v.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")).toISOString(),
);

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

const globalForPg = globalThis as unknown as { pgPool?: pg.Pool };

function pool() {
  if (!globalForPg.pgPool) {
    globalForPg.pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
  }
  return globalForPg.pgPool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await pool().query(text, params);
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

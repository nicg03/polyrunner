// Applica in ordine le migration in db/migrations non ancora eseguite.
// Con SEED_DEMO=true carica anche db/seed.sql se il database non ha ancora gare.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "db");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL non impostata");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied = new Set(
    (await client.query("select name from schema_migrations")).rows.map((r) => r.name),
  );
  const files = fs
    .readdirSync(path.join(root, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(root, "migrations", file), "utf8");
    console.log(`Applico ${file}...`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }

  if (process.env.SEED_DEMO === "true") {
    const { rows } = await client.query("select count(*)::int as n from races");
    if (rows[0].n === 0) {
      console.log("Carico i dati di esempio...");
      await client.query(fs.readFileSync(path.join(root, "seed.sql"), "utf8"));
    }
  }

  console.log("Database aggiornato.");
} finally {
  await client.end();
}

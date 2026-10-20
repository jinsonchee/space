// Applies any new SQL files in /migrations to the artist's own database.
// Runs automatically on every deploy (see "build" in package.json), so when
// an update ships with a new migration, each artist's database upgrades itself.
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL not set — skipping migrations.");
  process.exit(0);
}

const sql = postgres(url, { max: 1, onnotice: () => {}, prepare: false });
const dir = path.join(process.cwd(), "migrations");

try {
  await sql`create table if not exists schema_migrations (version text primary key, applied_at timestamptz default now())`;
  const done = new Set((await sql`select version from schema_migrations`).map((r) => r.version));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (version) values (${f})`;
    });
    console.log(`[migrate] applied ${f}`);
  }
  console.log("[migrate] database up to date");
} catch (e) {
  console.error("[migrate] failed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}

/**
 * Check whether our tables are reachable by Supabase's public API roles.
 *
 * Supabase exposes the `public` schema through PostgREST, authenticated with an
 * `anon` key that is designed to ship in browsers. Tables created through the
 * Supabase UI get row-level security enabled by default; tables created by a
 * migration tool — as ours were, via Prisma — do not. If `anon` also holds table
 * privileges, then anyone holding that public key can read the table directly,
 * completely bypassing this application's authorization.
 *
 *   npx tsx scripts/check-rls.ts
 */

import { config as loadEnv } from "dotenv";

for (const path of [".env.local", ".env"]) {
  loadEnv({ path, override: false, quiet: true });
}

const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("../src/generated/prisma/client.js");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const rls = await prisma.$queryRaw<
  Array<{ tablename: string; rowsecurity: boolean }>
>`
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename
`;

console.log("\nRow-level security by table:");
for (const row of rls) {
  console.log(`  ${row.rowsecurity ? "ON " : "OFF"}  ${row.tablename}`);
}

const grants = await prisma.$queryRaw<
  Array<{ grantee: string; table_name: string; privilege_type: string }>
>`
  SELECT grantee, table_name, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
  ORDER BY grantee, table_name, privilege_type
`;

const byGrantee = new Map<string, Set<string>>();
for (const g of grants) {
  if (!byGrantee.has(g.grantee)) byGrantee.set(g.grantee, new Set());
  byGrantee.get(g.grantee)!.add(g.table_name);
}

console.log("\nPrivileges held by Supabase's public API roles:");
if (byGrantee.size === 0) {
  console.log("  none — neither anon nor authenticated can touch these tables");
} else {
  for (const [grantee, tables] of byGrantee) {
    console.log(`  ${grantee}: ${tables.size} table(s)`);
    console.log(`    ${[...tables].sort().join(", ")}`);
  }
}

const exposed = rls.filter((t) => !t.rowsecurity && byGrantee.size > 0);

console.log("");
if (exposed.length > 0) {
  console.log(
    `EXPOSED: ${exposed.length} table(s) have RLS off AND are granted to a public API role.`,
  );
  console.log(
    "Anyone holding the project's anon key can read them over the REST API.\n",
  );
  process.exitCode = 1;
} else {
  console.log("No table is both RLS-off and reachable by a public API role.\n");
}

await prisma.$disconnect();

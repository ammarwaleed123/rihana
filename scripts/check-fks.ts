/**
 * Print the delete behaviour of every foreign key pointing at `children`.
 *
 *   npx tsx scripts/check-fks.ts
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

const rows = await prisma.$queryRaw<
  Array<{ constraint_name: string; table_name: string; delete_rule: string }>
>`
  SELECT rc.constraint_name,
         tc.table_name,
         rc.delete_rule
  FROM information_schema.referential_constraints rc
  JOIN information_schema.table_constraints tc
    ON tc.constraint_name = rc.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = rc.constraint_name
  WHERE ccu.table_name = 'children'
  ORDER BY tc.table_name
`;

console.log("\nForeign keys referencing children:");
for (const r of rows) {
  console.log(`  ${r.table_name.padEnd(20)} ${r.delete_rule.padEnd(10)} ${r.constraint_name}`);
}
console.log("");

await prisma.$disconnect();

/**
 * Creates (or resets) the two throwaway accounts the two-device manual test
 * matrix runs on. Development only: it refuses to touch a production database
 * because it writes a shared, well-known password.
 *
 * Usage: pnpm --filter @motionmeet/backend exec tsx scripts/seedTestAccounts.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDatabase, database, disconnectDatabase } from "../configs/database.js";

// Alphanumeric on purpose: these accounts get typed in by hand and through
// `adb shell input text`, where punctuation needs shell escaping.
const PASSWORD = process.env.TEST_ACCOUNT_PASSWORD ?? "MotionTest2026";

const ACCOUNTS = [
  { email: "tester.a@motionmeet.test", username: "tester_a", full_name: "Tester A" },
  { email: "tester.b@motionmeet.test", username: "tester_b", full_name: "Tester B" },
];

const run = async (): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed shared-password test accounts in production");
    process.exitCode = 1;
    return;
  }
  try {
    await connectDatabase();
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    for (const account of ACCOUNTS) {
      const row = await database
        .insertInto("users")
        .values({ legacy_mongo_id: null, password_hash: passwordHash, ...account })
        .onConflict((conflict) => conflict.column("email").doUpdateSet({ password_hash: passwordHash }))
        .returning(["id", "email", "username"])
        .executeTakeFirstOrThrow();
      console.log(`${row.username} <${row.email}> ${row.id}`);
    }
    console.log(`password: ${PASSWORD}`);
  } finally {
    await disconnectDatabase().catch(() => undefined);
  }
};

await run();

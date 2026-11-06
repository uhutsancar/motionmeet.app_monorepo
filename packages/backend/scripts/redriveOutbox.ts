import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../configs/database.js";
import { redriveDeadOutboxEvents } from "../services/outboxService.js";

/**
 * Puts dead outbox events back in the queue: `outbox:redrive [event-id ...]`,
 * or every dead event with no ids. Fix the cause first (docs/operations/RUNBOOKS.md);
 * consumers deduplicate, so redriving an event already applied is safe.
 */
const eventIds = process.argv.slice(2);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = eventIds.filter((id) => !UUID.test(id));
if (invalid.length) {
  console.error(`Not event ids: ${invalid.join(", ")}`);
  process.exit(2);
}
try {
  await connectDatabase();
  const count = await redriveDeadOutboxEvents({ eventIds });
  console.log(`Redriven ${count} dead outbox event(s).`);
} finally {
  await disconnectDatabase();
}

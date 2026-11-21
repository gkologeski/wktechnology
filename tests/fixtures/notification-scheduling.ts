import { readFileSync } from "node:fs";
import type postgres from "postgres";

/** P12 runs the real additive migration after all P1–P11 authorization sources. */
export async function setupNotificationScheduling(db: postgres.Sql) {
  await db.unsafe(readFileSync("drizzle/migrations/0401_notification_scheduling.sql", "utf8"));
}

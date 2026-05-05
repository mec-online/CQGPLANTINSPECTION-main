import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { ppmSchedules } from "./ppm-schedules.js";
import { users } from "./users.js";

export const ppmCompletions = pgTable("ppm_completions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  ppmScheduleId: text("ppm_schedule_id")
    .notNull()
    .references(() => ppmSchedules.id),
  completedById: text("completed_by_id")
    .notNull()
    .references(() => users.id),
  completedAt: timestamp("completed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  notes: text("notes"),
});

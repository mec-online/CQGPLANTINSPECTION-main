import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { assets } from "./assets.js";
import { sites } from "./sites.js";
import { users } from "./users.js";

export const breakdowns = pgTable("breakdowns", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id),
  reportedById: text("reported_by_id")
    .notNull()
    .references(() => users.id),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  manHours: doublePrecision("man_hours"),
  partsCost: doublePrecision("parts_cost"),
  description: text("description").notNull(),
  cause: text("cause"),
  resolution: text("resolution"),
  area: text("area"),
});

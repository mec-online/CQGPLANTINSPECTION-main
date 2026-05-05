import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { inspectionStatusEnum, inspectionResultEnum } from "./enums.js";
import { inspectionTemplates } from "./inspection-templates.js";
import { assets } from "./assets.js";
import { sites } from "./sites.js";
import { users } from "./users.js";

export const inspections = pgTable("inspections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  templateId: text("template_id")
    .notNull()
    .references(() => inspectionTemplates.id),
  assetId: text("asset_id").references(() => assets.id),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedById: text("completed_by_id").references(() => users.id),
  status: inspectionStatusEnum("status").notNull().default("IN_PROGRESS"),
  overallResult: inspectionResultEnum("overall_result"),
  locationLat: doublePrecision("location_lat"),
  locationLng: doublePrecision("location_lng"),
});

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { assets } from "./assets.js";
import { sites } from "./sites.js";
import { users } from "./users.js";
import { inspections } from "./inspections.js";

export const assetMovements = pgTable("asset_movements", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id),
  fromSiteId: text("from_site_id").references(() => sites.id),
  toSiteId: text("to_site_id")
    .notNull()
    .references(() => sites.id),
  movedById: text("moved_by_id")
    .notNull()
    .references(() => users.id),
  movedAt: timestamp("moved_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  preInspectionId: text("pre_inspection_id").references(() => inspections.id),
  postInspectionId: text("post_inspection_id").references(
    () => inspections.id,
  ),
  notes: text("notes"),
});

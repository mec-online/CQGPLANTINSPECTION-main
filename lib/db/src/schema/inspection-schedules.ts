import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { inspectionTemplates } from "./inspection-templates.js";
import { assets } from "./assets.js";
import { sites } from "./sites.js";

export const inspectionSchedules = pgTable("inspection_schedules", {
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
  frequency: text("frequency").notNull(),
  nextDueAt: timestamp("next_due_at", { withTimezone: true }).notNull(),
  assignedRoleId: text("assigned_role_id"),
});

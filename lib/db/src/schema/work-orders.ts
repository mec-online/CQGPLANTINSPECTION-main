import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { priorityEnum, workOrderStatusEnum } from "./enums.js";
import { inspections } from "./inspections.js";
import { inspectionAnswers } from "./inspection-answers.js";
import { assets } from "./assets.js";
import { sites } from "./sites.js";
import { users } from "./users.js";

export const workOrders = pgTable("work_orders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  inspectionId: text("inspection_id").references(() => inspections.id),
  inspectionAnswerId: text("inspection_answer_id").references(
    () => inspectionAnswers.id,
  ),
  assetId: text("asset_id").references(() => assets.id),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id),
  title: text("title").notNull(),
  description: text("description"),
  priority: priorityEnum("priority").notNull().default("MEDIUM"),
  status: workOrderStatusEnum("status").notNull().default("OPEN"),
  assignedToId: text("assigned_to_id").references(() => users.id),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedById: text("verified_by_id").references(() => users.id),
});

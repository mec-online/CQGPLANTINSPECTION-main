import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users.js";
import { workOrders } from "./work-orders.js";
import { inspectionAnswers } from "./inspection-answers.js";
import { breakdowns } from "./breakdowns.js";
import { assetMovements } from "./asset-movements.js";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const attachments = pgTable("attachments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  uploadedById: text("uploaded_by_id")
    .notNull()
    .references(() => users.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  deviceInfo: text("device_info"),
  workOrderId: text("work_order_id").references(() => workOrders.id),
  inspectionAnswerId: text("inspection_answer_id").references(
    () => inspectionAnswers.id,
  ),
  breakdownId: text("breakdown_id").references(() => breakdowns.id),
  assetMovementId: text("asset_movement_id").references(
    () => assetMovements.id,
  ),
});

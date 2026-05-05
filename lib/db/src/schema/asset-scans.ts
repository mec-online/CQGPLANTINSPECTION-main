import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { scanMethodEnum } from "./enums.js";
import { assets } from "./assets.js";
import { users } from "./users.js";

export const assetScans = pgTable("asset_scans", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id),
  scannedById: text("scanned_by_id")
    .notNull()
    .references(() => users.id),
  scannedAt: timestamp("scanned_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  method: scanMethodEnum("method").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  deviceInfo: text("device_info"),
});

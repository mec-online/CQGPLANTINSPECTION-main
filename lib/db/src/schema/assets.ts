import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { criticalityEnum } from "./enums.js";
import { sites } from "./sites.js";
import { areas } from "./areas.js";

export const assets = pgTable("assets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id),
  areaId: text("area_id").references(() => areas.id),
  name: text("name").notNull(),
  plantId: text("plant_id"),
  serialNumber: text("serial_number"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  installDate: timestamp("install_date", { withTimezone: true }),
  criticality: criticalityEnum("criticality").notNull().default("MEDIUM"),
  isMobile: boolean("is_mobile").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
});

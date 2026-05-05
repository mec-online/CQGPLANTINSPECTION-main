import { boolean, pgTable, text } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { templateTypeEnum } from "./enums.js";
import { sites } from "./sites.js";

export const inspectionTemplates = pgTable("inspection_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  type: templateTypeEnum("type").notNull(),
  siteId: text("site_id").references(() => sites.id),
  isActive: boolean("is_active").notNull().default(true),
});

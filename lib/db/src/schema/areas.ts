import { pgTable, text } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { sites } from "./sites.js";

export const areas = pgTable("areas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id),
  name: text("name").notNull(),
  description: text("description"),
});

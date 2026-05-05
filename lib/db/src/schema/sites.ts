import { boolean, pgTable, text } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const sites = pgTable("sites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
});

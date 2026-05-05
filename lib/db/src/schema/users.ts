import { boolean, pgTable, text } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { userRoleEnum } from "./enums.js";
import { sites } from "./sites.js";

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  siteId: text("site_id").references(() => sites.id),
  isActive: boolean("is_active").notNull().default(true),
});

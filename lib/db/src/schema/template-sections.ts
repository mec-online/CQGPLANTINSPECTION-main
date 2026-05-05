import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { inspectionTemplates } from "./inspection-templates.js";

export const templateSections = pgTable("template_sections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  templateId: text("template_id")
    .notNull()
    .references(() => inspectionTemplates.id),
  title: text("title").notNull(),
  order: integer("order").notNull(),
});

import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { templateSections } from "./template-sections.js";

export const templateQuestions = pgTable("template_questions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  sectionId: text("section_id")
    .notNull()
    .references(() => templateSections.id),
  text: text("text").notNull(),
  order: integer("order").notNull(),
  requiresEvidenceOnFail: boolean("requires_evidence_on_fail")
    .notNull()
    .default(false),
  allowMonitor: boolean("allow_monitor").notNull().default(true),
  helpText: text("help_text"),
});

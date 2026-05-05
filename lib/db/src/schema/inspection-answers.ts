import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { answerResultEnum } from "./enums.js";
import { inspections } from "./inspections.js";
import { templateQuestions } from "./template-questions.js";
import { users } from "./users.js";

export const inspectionAnswers = pgTable("inspection_answers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  inspectionId: text("inspection_id")
    .notNull()
    .references(() => inspections.id),
  questionId: text("question_id")
    .notNull()
    .references(() => templateQuestions.id),
  result: answerResultEnum("result").notNull(),
  notes: text("notes"),
  answeredById: text("answered_by_id").references(() => users.id),
  answeredAt: timestamp("answered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  locationLat: doublePrecision("location_lat"),
  locationLng: doublePrecision("location_lng"),
});

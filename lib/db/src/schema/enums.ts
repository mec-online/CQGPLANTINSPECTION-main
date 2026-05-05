import { pgEnum } from "drizzle-orm/pg-core";

export const criticalityEnum = pgEnum("criticality", [
  "HIGH",
  "MEDIUM",
  "LOW",
]);

export const templateTypeEnum = pgEnum("template_type", [
  "PRESTART",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "PRE_MOVEMENT",
  "POST_MOVEMENT",
]);

export const inspectionStatusEnum = pgEnum("inspection_status", [
  "IN_PROGRESS",
  "COMPLETED",
  "ABANDONED",
]);

export const inspectionResultEnum = pgEnum("inspection_result", [
  "PASS",
  "FAIL",
  "MONITOR",
]);

export const answerResultEnum = pgEnum("answer_result", [
  "PASS",
  "FAIL",
  "MONITOR",
  "NA",
]);

export const priorityEnum = pgEnum("priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export const workOrderStatusEnum = pgEnum("work_order_status", [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "COMPLETED",
  "VERIFIED",
]);

export const ppmFrequencyEnum = pgEnum("ppm_frequency", [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
]);

export const userRoleEnum = pgEnum("user_role", [
  "OPERATOR",
  "SITE_MANAGER",
  "MAINTENANCE",
  "ADMIN",
  "READONLY",
]);

export const scanMethodEnum = pgEnum("scan_method", ["QR", "NFC"]);

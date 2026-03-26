import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Checklist item result ───────────────────────────────────────────────────
export const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["ok", "faulty"]),
  comment: z.string().optional(),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

// ─── Pre-start submission ────────────────────────────────────────────────────
export const prestarts = sqliteTable("prestarts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operatorName: text("operator_name").notNull(),
  machine: text("machine").notNull(),
  hours: integer("hours").notNull(),
  serviceDueHours: integer("service_due_hours").notNull(),
  serviceDueDate: text("service_due_date").notNull(),
  inspectionDate: text("inspection_date").notNull(),
  correctiveItems: text("corrective_items").notNull(),   // JSON string
  doNotOperateItems: text("do_not_operate_items").notNull(), // JSON string
  comments: text("comments"),
  hasFaults: integer("has_faults", { mode: "boolean" }).notNull().default(false),
  hasCriticalFaults: integer("has_critical_faults", { mode: "boolean" }).notNull().default(false),
  serviceAlertSent: integer("service_alert_sent", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const insertPrestartSchema = createInsertSchema(prestarts).omit({
  id: true,
  createdAt: true,
});

// API submission schema: accepts arrays for JSON columns (client sends arrays, DB stores as text)
export const submitPrestartSchema = insertPrestartSchema.extend({
  correctiveItems: z.union([z.string(), z.array(z.any())]).transform((v) =>
    typeof v === "string" ? v : JSON.stringify(v)
  ),
  doNotOperateItems: z.union([z.string(), z.array(z.any())]).transform((v) =>
    typeof v === "string" ? v : JSON.stringify(v)
  ),
});

export type InsertPrestart = z.infer<typeof insertPrestartSchema>;
export type Prestart = typeof prestarts.$inferSelect;

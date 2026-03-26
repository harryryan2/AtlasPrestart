import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPrestartSchema } from "@shared/schema";
import { z } from "zod";
import nodemailer from "nodemailer";

// Override schema: accept arrays for JSON columns (client sends arrays, DB stores as strings)
const submitPrestartSchema = insertPrestartSchema.extend({
  correctiveItems: z.union([z.string(), z.array(z.any())]).transform((v) =>
    typeof v === "string" ? v : JSON.stringify(v)
  ),
  doNotOperateItems: z.union([z.string(), z.array(z.any())]).transform((v) =>
    typeof v === "string" ? v : JSON.stringify(v)
  ),
});
import { format, differenceInDays, parseISO, addDays } from "date-fns";

// ─── Email config ─────────────────────────────────────────────────────────────
// Uses Outlook/Office365 SMTP. Credentials injected via env vars.
const SUPERVISOR_EMAIL = "zach@atlaspaving.au";
const FROM_EMAIL = process.env.SMTP_FROM || "prestart@atlaspaving.au";

function createTransport() {
  // Uses environment variables for credentials
  // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
  // Falls back to a test mode if no credentials configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Dev/demo mode — logs emails to console
  return null;
}

async function sendEmail(subject: string, html: string) {
  const transport = createTransport();
  if (!transport) {
    console.log("📧 [EMAIL DEMO MODE] Would send to:", SUPERVISOR_EMAIL);
    console.log("Subject:", subject);
    return { success: true, demo: true };
  }
  try {
    await transport.sendMail({
      from: FROM_EMAIL,
      to: SUPERVISOR_EMAIL,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error("Email send failed:", err);
    return { success: false, error: String(err) };
  }
}

function buildFaultEmail(prestart: any): string {
  const dnoItems = typeof prestart.doNotOperateItems === "string" ? JSON.parse(prestart.doNotOperateItems) : prestart.doNotOperateItems;
  const corrItemsAll = typeof prestart.correctiveItems === "string" ? JSON.parse(prestart.correctiveItems) : prestart.correctiveItems;
  const critItems = dnoItems.filter((i: any) => i.status === "faulty");
  const corrItems = corrItemsAll.filter((i: any) => i.status === "faulty");

  let rows = "";
  if (critItems.length) {
    rows += `<tr><td colspan="3" style="background:#fee2e2;font-weight:bold;padding:8px 12px;color:#991b1b;">🚫 DO NOT OPERATE — Critical Faults</td></tr>`;
    critItems.forEach((item: any) => {
      rows += `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${item.label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#dc2626;font-weight:600;">FAULTY</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${item.comment || "—"}</td>
      </tr>`;
    });
  }
  if (corrItems.length) {
    rows += `<tr><td colspan="3" style="background:#fef9c3;font-weight:bold;padding:8px 12px;color:#854d0e;">⚠️ Corrective Action Required</td></tr>`;
    corrItems.forEach((item: any) => {
      rows += `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${item.label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#d97706;font-weight:600;">FAULTY</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${item.comment || "—"}</td>
      </tr>`;
    });
  }

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1e3a5f;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:20px;">⚠️ Pre-Start Fault Report</h2>
        <p style="margin:4px 0 0;opacity:0.85;font-size:14px;">Atlas Paving — Machine Pre-Start Checklist</p>
      </div>
      <div style="background:#f8fafc;padding:20px 24px;border:1px solid #e2e8f0;border-top:none;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Operator</td><td style="padding:4px 0;font-weight:600;">${prestart.operatorName}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Machine</td><td style="padding:4px 0;font-weight:600;">${prestart.machine}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Inspection Date</td><td style="padding:4px 0;font-weight:600;">${prestart.inspectionDate}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:14px;">Current Hours</td><td style="padding:4px 0;font-weight:600;">${prestart.hours} hrs</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:10px 12px;text-align:left;font-size:13px;color:#475569;">Component</th>
              <th style="padding:10px 12px;text-align:left;font-size:13px;color:#475569;">Status</th>
              <th style="padding:10px 12px;text-align:left;font-size:13px;color:#475569;">Fault Description</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${prestart.comments ? `<div style="margin-top:16px;padding:12px;background:#f1f5f9;border-radius:6px;"><strong>Additional Comments:</strong><p style="margin:4px 0 0;">${prestart.comments}</p></div>` : ""}
      </div>
      <div style="padding:12px 24px;background:#f1f5f9;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none;font-size:12px;color:#94a3b8;">
        Submitted via Atlas Paving Pre-Start App
      </div>
    </div>
  `;
}

function buildServiceEmail(prestart: any): string {
  const hoursRemaining = prestart.serviceDueHours - prestart.hours;
  const dueDate = prestart.serviceDueDate;
  const today = new Date();
  const dueDateObj = parseISO(dueDate);
  const daysRemaining = differenceInDays(dueDateObj, today);

  let urgencyMsg = "";
  if (hoursRemaining <= 0) {
    urgencyMsg = `<div style="background:#fee2e2;border:1px solid #fca5a5;padding:12px 16px;border-radius:6px;margin-bottom:16px;color:#991b1b;font-weight:600;">🔴 SERVICE OVERDUE — Machine has exceeded service interval</div>`;
  } else if (hoursRemaining <= 25) {
    urgencyMsg = `<div style="background:#fff7ed;border:1px solid #fed7aa;padding:12px 16px;border-radius:6px;margin-bottom:16px;color:#c2410c;font-weight:600;">🟠 SERVICE IMMINENT — ${hoursRemaining} hours remaining</div>`;
  } else {
    urgencyMsg = `<div style="background:#fef9c3;border:1px solid #fde68a;padding:12px 16px;border-radius:6px;margin-bottom:16px;color:#854d0e;font-weight:600;">🟡 SERVICE DUE SOON — ${hoursRemaining} hours / ${daysRemaining} days remaining</div>`;
  }

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1e3a5f;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:20px;">🔧 Service Due Alert</h2>
        <p style="margin:4px 0 0;opacity:0.85;font-size:14px;">Atlas Paving — Machine Pre-Start Checklist</p>
      </div>
      <div style="background:#f8fafc;padding:20px 24px;border:1px solid #e2e8f0;border-top:none;">
        ${urgencyMsg}
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:6px;padding:16px;border:1px solid #e2e8f0;">
          <tr><td style="padding:8px 12px;color:#64748b;font-size:14px;border-bottom:1px solid #f3f4f6;">Operator</td><td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #f3f4f6;">${prestart.operatorName}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b;font-size:14px;border-bottom:1px solid #f3f4f6;">Machine</td><td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #f3f4f6;">${prestart.machine}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b;font-size:14px;border-bottom:1px solid #f3f4f6;">Current Hours</td><td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #f3f4f6;">${prestart.hours} hrs</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b;font-size:14px;border-bottom:1px solid #f3f4f6;">Service Due Hours</td><td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #f3f4f6;">${prestart.serviceDueHours} hrs</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b;font-size:14px;">Service Due Date</td><td style="padding:8px 12px;font-weight:600;">${dueDate}</td></tr>
        </table>
      </div>
      <div style="padding:12px 24px;background:#f1f5f9;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none;font-size:12px;color:#94a3b8;">
        Submitted via Atlas Paving Pre-Start App
      </div>
    </div>
  `;
}

export async function registerRoutes(httpServer: Server, app: Express) {
  // ─── Submit pre-start ───────────────────────────────────────────────────────
  app.post("/api/prestarts", async (req, res) => {
    try {
      const parsed = submitPrestartSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      }

      const data = parsed.data;
      const prestart = await storage.createPrestart(data);

      // ─── Send fault email ─────────────────────────────────────────────────
      if (data.hasFaults || data.hasCriticalFaults) {
        const subject = data.hasCriticalFaults
          ? `🚫 DO NOT OPERATE: Fault on ${data.machine} — ${data.operatorName} [${data.inspectionDate}]`
          : `⚠️ Corrective Action Required: ${data.machine} — ${data.operatorName} [${data.inspectionDate}]`;
        await sendEmail(subject, buildFaultEmail(data));
      }

      // ─── Send service alert email ─────────────────────────────────────────
      const hoursRemaining = data.serviceDueHours - data.hours;
      const today = new Date();
      const dueDate = parseISO(data.serviceDueDate);
      const daysUntilService = differenceInDays(dueDate, today);

      if (hoursRemaining <= 50 || daysUntilService <= 14) {
        const subject = hoursRemaining <= 0
          ? `🔴 SERVICE OVERDUE: ${data.machine} — ${data.hours} hrs / Due ${data.serviceDueHours} hrs`
          : `🔧 Service Due Soon: ${data.machine} — ${hoursRemaining} hrs remaining`;
        await sendEmail(subject, buildServiceEmail(data));
      }

      // ─── SharePoint upload ────────────────────────────────────────────────
      // SharePoint integration handled client-side via MSAL (Microsoft Auth Library)
      // The server returns the full record for client to upload to SP
      res.status(201).json({ success: true, data: prestart });
    } catch (err) {
      console.error("Submit error:", err);
      res.status(500).json({ error: "Submission failed" });
    }
  });

  // ─── Get all submissions (for history view) ────────────────────────────────
  app.get("/api/prestarts", async (_req, res) => {
    const all = await storage.getPrestarts();
    res.json(all);
  });

  // ─── Delete a submission ───────────────────────────────────────────────────
  app.delete("/api/prestarts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
      await storage.deletePrestart(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete error:", err);
      res.status(500).json({ error: "Delete failed" });
    }
  });

  // ─── Health check ──────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
}

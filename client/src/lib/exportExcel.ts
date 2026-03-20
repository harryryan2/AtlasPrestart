import * as XLSX from "xlsx";

export function exportSubmissionToExcel(data: any) {
  const wb = XLSX.utils.book_new();

  // ─── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summaryRows = [
    ["ATLAS PAVING — MACHINE PRE-START CHECKLIST"],
    [],
    ["Operator Name", data.operatorName],
    ["Machine", data.machine],
    ["Inspection Date", data.inspectionDate],
    ["Current Hours", data.hours],
    ["Service Due Hours", data.serviceDueHours],
    ["Service Due Date", data.serviceDueDate],
    [],
    ["Overall Status", data.hasCriticalFaults ? "DO NOT OPERATE" : data.hasFaults ? "CORRECTIVE ACTION REQUIRED" : "ALL CLEAR"],
    [],
    ["Additional Comments", data.comments || "—"],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);

  // Style column widths
  summarySheet["!cols"] = [{ wch: 22 }, { wch: 40 }];

  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // ─── Sheet 2: Corrective Action items ──────────────────────────────────────
  const corrHeaders = [["Component", "Status", "Fault Description"]];
  const corrRows = (data.correctiveItems as any[]).map((item) => [
    item.label,
    item.status === "ok" ? "Operational" : "FAULTY",
    item.comment || "",
  ]);

  const corrSheet = XLSX.utils.aoa_to_sheet([...corrHeaders, ...corrRows]);
  corrSheet["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, corrSheet, "Corrective Action");

  // ─── Sheet 3: Do Not Operate items ────────────────────────────────────────
  const dnoHeaders = [["Component", "Status", "Fault Description"]];
  const dnoRows = (data.doNotOperateItems as any[]).map((item) => [
    item.label,
    item.status === "ok" ? "Operational" : "FAULTY",
    item.comment || "",
  ]);

  const dnoSheet = XLSX.utils.aoa_to_sheet([...dnoHeaders, ...dnoRows]);
  dnoSheet["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, dnoSheet, "Do Not Operate");

  // ─── Generate filename ─────────────────────────────────────────────────────
  const safeMachine = data.machine.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
  const safeOperator = data.operatorName.split(" ")[0];
  const filename = `PreStart_${safeMachine}_${safeOperator}_${data.inspectionDate}.xlsx`;

  // ─── Trigger download ──────────────────────────────────────────────────────
  XLSX.writeFile(wb, filename);
}

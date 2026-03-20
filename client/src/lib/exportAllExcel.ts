import * as XLSX from "xlsx";

export function exportAllSubmissionsToExcel(submissions: any[]) {
  if (submissions.length === 0) return;

  const wb = XLSX.utils.book_new();

  // ─── Sheet 1: All submissions log ─────────────────────────────────────────
  const headers = [
    "Date",
    "Operator",
    "Machine",
    "Hours",
    "Service Due Hours",
    "Service Due Date",
    "Status",
    "Corrective Faults",
    "Critical Faults",
    "Comments",
  ];

  const rows = submissions.map((s) => {
    const correctiveFaults = (s.correctiveItems as any[])
      .filter((i) => i.status === "faulty")
      .map((i) => `${i.label}: ${i.comment || "no detail"}`)
      .join("; ");

    const criticalFaults = (s.doNotOperateItems as any[])
      .filter((i) => i.status === "faulty")
      .map((i) => `${i.label}: ${i.comment || "no detail"}`)
      .join("; ");

    return [
      s.inspectionDate,
      s.operatorName,
      s.machine,
      s.hours,
      s.serviceDueHours,
      s.serviceDueDate,
      s.hasCriticalFaults ? "DO NOT OPERATE" : s.hasFaults ? "CORRECTIVE ACTION" : "ALL CLEAR",
      correctiveFaults || "None",
      criticalFaults || "None",
      s.comments || "",
    ];
  });

  const logSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  logSheet["!cols"] = [
    { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 10 },
    { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 40 },
    { wch: 40 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, logSheet, "All Pre-Starts");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `PreStart_Log_${today}.xlsx`);
}

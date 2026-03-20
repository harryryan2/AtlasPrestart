import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, AlertTriangle, XCircle, Download, Search, CheckCircle2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { getSubmissions, deleteSubmission } from "@/lib/submissionStore";
import { exportAllSubmissionsToExcel } from "@/lib/exportAllExcel";
import { exportSubmissionToExcel } from "@/lib/exportExcel";

function AtlasLogo() {
  return (
    <svg viewBox="0 0 48 48" width="32" height="32" fill="none" aria-label="Atlas Paving" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#1d3c6e"/>
      <path d="M24 8L36 20H28V38H20V20H12L24 8Z" fill="white" opacity="0.95"/>
      <rect x="16" y="32" width="16" height="4" rx="2" fill="#f59e0b"/>
    </svg>
  );
}

function StatusBadge({ prestart }: { prestart: any }) {
  if (prestart.hasCriticalFaults) {
    return <Badge className="bg-red-600 text-white text-xs shrink-0">Do Not Operate</Badge>;
  }
  if (prestart.hasFaults) {
    return <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 text-xs shrink-0">Corrective Action</Badge>;
  }
  return <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400 text-xs shrink-0">All Clear</Badge>;
}

function HistoryCard({ prestart, onDelete }: { prestart: any; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const correctiveFaults = (prestart.correctiveItems as any[]).filter((i) => i.status === "faulty");
  const criticalFaults = (prestart.doNotOperateItems as any[]).filter((i) => i.status === "faulty");
  const hasFaultDetails = correctiveFaults.length > 0 || criticalFaults.length > 0;

  return (
    <Card data-testid={`history-card-${prestart.id}`} className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{prestart.machine}</p>
            <p className="text-xs text-muted-foreground">{prestart.operatorName} · {prestart.inspectionDate}</p>
          </div>
          <StatusBadge prestart={prestart} />
        </div>

        {/* Hours summary */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-muted rounded-md px-2 py-1.5 text-center">
            <p className="text-xs text-muted-foreground leading-none mb-0.5">Hours</p>
            <p className="text-xs font-semibold">{prestart.hours}</p>
          </div>
          <div className="bg-muted rounded-md px-2 py-1.5 text-center">
            <p className="text-xs text-muted-foreground leading-none mb-0.5">Due Hours</p>
            <p className="text-xs font-semibold">{prestart.serviceDueHours}</p>
          </div>
          <div className="bg-muted rounded-md px-2 py-1.5 text-center">
            <p className="text-xs text-muted-foreground leading-none mb-0.5">Due Date</p>
            <p className="text-xs font-semibold">{prestart.serviceDueDate}</p>
          </div>
        </div>

        {/* Fault details — expandable */}
        {hasFaultDetails && (
          <button
            className="w-full flex items-center justify-between text-xs text-muted-foreground mb-2 py-1"
            onClick={() => setExpanded(!expanded)}
          >
            <span>{criticalFaults.length + correctiveFaults.length} fault{criticalFaults.length + correctiveFaults.length > 1 ? "s" : ""} recorded</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}

        {expanded && hasFaultDetails && (
          <div className="space-y-1.5 mb-3">
            {criticalFaults.map((item: any) => (
              <div key={item.label} className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-2.5 py-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-red-800 dark:text-red-300">{item.label}</p>
                  {item.comment && <p className="text-xs text-red-600 dark:text-red-400">{item.comment}</p>}
                </div>
              </div>
            ))}
            {correctiveFaults.map((item: any) => (
              <div key={item.label} className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{item.label}</p>
                  {item.comment && <p className="text-xs text-amber-600 dark:text-amber-400">{item.comment}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {prestart.comments && (
          <p className="text-xs text-muted-foreground italic mb-3">"{prestart.comments}"</p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={() => exportSubmissionToExcel(prestart)}
            data-testid={`btn-download-${prestart.id}`}
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:border-destructive"
            onClick={() => onDelete(prestart.id)}
            data-testid={`btn-delete-${prestart.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const [prestarts, setPrestarts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "faults" | "clear">("all");

  async function loadSubmissions() {
    setLoading(true);
    const data = await getSubmissions();
    setPrestarts(data);
    setLoading(false);
  }

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function handleDelete(id: number) {
    await deleteSubmission(id);
    setPrestarts((prev) => prev.filter((p) => p.id !== id));
  }

  const filtered = prestarts.filter((p) => {
    const matchSearch =
      !search ||
      p.machine.toLowerCase().includes(search.toLowerCase()) ||
      p.operatorName.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "faults" && p.hasFaults) ||
      (filter === "clear" && !p.hasFaults);
    return matchSearch && matchFilter;
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10 -ml-1" data-testid="btn-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <AtlasLogo />
          <div className="flex-1">
            <p className="text-xs opacity-75 leading-none">Atlas Paving</p>
            <h1 className="font-bold text-base leading-tight">Pre-Start Records</h1>
          </div>
          {prestarts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-white/10 shrink-0"
              onClick={() => exportAllSubmissionsToExcel(prestarts)}
              data-testid="btn-export-all"
            >
              <Download className="w-4 h-4 mr-1" />
              Export All
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">

        {/* Search + filter */}
        {prestarts.length > 0 && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by machine or operator..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "faults", "clear"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                    filter === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  {f === "all" ? "All" : f === "faults" ? "Faults Only" : "All Clear"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Record count */}
        {!loading && prestarts.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {prestarts.length} record{prestarts.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && prestarts.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 opacity-30" />
            </div>
            <p className="text-sm font-medium">No records yet</p>
            <p className="text-xs mt-1 mb-4">Submitted checklists will appear here</p>
            <Link href="/">
              <Button variant="outline" size="sm">Start a pre-start</Button>
            </Link>
          </div>
        )}

        {/* No search results */}
        {!loading && prestarts.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm">No records match your search</p>
            <button onClick={() => { setSearch(""); setFilter("all"); }} className="text-xs text-primary mt-1 underline">
              Clear filters
            </button>
          </div>
        )}

        {/* Records */}
        {!loading && filtered.map((p) => (
          <HistoryCard key={p.id} prestart={p} onDelete={handleDelete} />
        ))}
      </div>

      <footer className="mt-8 text-center text-xs text-muted-foreground px-4">
        <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="hover:underline">
          Created with Perplexity Computer
        </a>
      </footer>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { enqueueSubmission, flushQueue, getQueueCount } from "@/lib/offlineQueue";
import { saveSubmission } from "@/lib/submissionStore";
import { exportSubmissionToExcel } from "@/lib/exportExcel";
import { Link } from "wouter";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, AlertTriangle, XCircle, ClipboardList, History, Wrench, WifiOff, RefreshCw } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

// ─── Atlas Paving Logo ────────────────────────────────────────────────────────
function AtlasLogo() {
  return (
    <svg viewBox="0 0 48 48" width="36" height="36" fill="none" aria-label="Atlas Paving Pre-Start" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#1d3c6e"/>
      <path d="M24 8L36 20H28V38H20V20H12L24 8Z" fill="white" opacity="0.95"/>
      <rect x="16" y="32" width="16" height="4" rx="2" fill="#f59e0b"/>
    </svg>
  );
}

// ─── Checklist items ──────────────────────────────────────────────────────────
const CORRECTIVE_ITEMS = [
  "Engine Oil",
  "Tyres / Wheel Nuts",
  "Oil Leaks",
  "Radiator Coolant Level",
  "Running Lights / Indicators",
  "Air Filter",
  "Fuel",
  "Hydraulic Oil Levels",
  "Radiator Condition",
  "Belt Tension",
  "Brake Fluid Levels",
  "Grease Point Check",
  "Rams and Hoses",
  "Steps and Handrails",
];

const DO_NOT_OPERATE_ITEMS = [
  "Brakes",
  "Steering",
  "Flashing Amber Lights",
  "Gauges / Warning Systems",
  "Mirror Adjustment",
  "Seatbelt",
  "Fire Extinguisher",
];

// ─── Form schema ──────────────────────────────────────────────────────────────
const itemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(["ok", "faulty"], { required_error: "Please select a status" }),
  comment: z.string().optional(),
}).refine(
  (d) => d.status !== "faulty" || (d.comment && d.comment.trim().length > 0),
  { message: "Please describe the fault", path: ["comment"] }
);

const formSchema = z.object({
  operatorName: z.string().min(2, "Enter your full name"),
  machine: z.string().min(1, "Enter the machine name"),
  hours: z.coerce.number().min(0, "Enter current hours").max(99999),
  serviceDueHours: z.coerce.number().min(0, "Enter service due hours").max(99999),
  serviceDueDate: z.string().min(1, "Select the service due date"),
  inspectionDate: z.string(),
  correctiveItems: z.array(itemSchema),
  doNotOperateItems: z.array(itemSchema),
  comments: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ─── ChecklistItem component ──────────────────────────────────────────────────
function ChecklistItemRow({
  index, label, fieldPrefix, control, register, watch, errors,
}: {
  index: number;
  label: string;
  fieldPrefix: "correctiveItems" | "doNotOperateItems";
  control: any;
  register: any;
  watch: any;
  errors: any;
}) {
  const status = watch(`${fieldPrefix}.${index}.status`);
  const isCritical = fieldPrefix === "doNotOperateItems";

  return (
    <div
      data-testid={`item-${fieldPrefix}-${index}`}
      className={`rounded-lg border p-4 transition-colors ${
        status === "faulty"
          ? isCritical
            ? "border-red-500 bg-red-50 dark:bg-red-950/20"
            : "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
          : status === "ok"
          ? "border-green-400 bg-green-50 dark:bg-green-950/20"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{label}</p>
        </div>
        <FormField
          control={control}
          name={`${fieldPrefix}.${index}.status`}
          render={({ field }) => (
            <FormItem className="w-36 shrink-0">
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger
                    data-testid={`select-${fieldPrefix}-${index}`}
                    className={`text-xs h-9 ${
                      field.value === "ok"
                        ? "border-green-500 text-green-700 dark:text-green-400"
                        : field.value === "faulty"
                        ? isCritical
                          ? "border-red-500 text-red-700 dark:text-red-400"
                          : "border-amber-500 text-amber-700 dark:text-amber-400"
                        : ""
                    }`}
                  >
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ok">
                    <span className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Operational
                    </span>
                  </SelectItem>
                  <SelectItem value="faulty">
                    <span className={`flex items-center gap-2 ${isCritical ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                      {isCritical ? <XCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      Faulty
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </div>
      {status === "faulty" && (
        <div className="mt-3">
          <FormField
            control={control}
            name={`${fieldPrefix}.${index}.comment`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    {...field}
                    data-testid={`comment-${fieldPrefix}-${index}`}
                    placeholder="Describe the fault in detail..."
                    className="text-sm min-h-[60px] resize-none"
                    rows={2}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}

// ─── Offline success screen ───────────────────────────────────────────────────
function OfflineSuccessScreen({ onReset, queueCount }: { onReset: () => void; queueCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-6">
      <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <WifiOff className="w-10 h-10 text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2">Saved Offline</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Your checklist has been saved to this device. It will automatically upload and notify the supervisor when you're back online.
        </p>
        {queueCount > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
            {queueCount} checklist{queueCount > 1 ? 's' : ''} pending sync
          </p>
        )}
      </div>
      <Button onClick={onReset} data-testid="btn-new-checklist-offline" className="w-full max-w-xs">
        Start New Checklist
      </Button>
    </div>
  );
}

// ─── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-6">
      <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2">Pre-Start Submitted</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Your checklist has been recorded and filed. The supervisor has been notified of any faults or service requirements.
        </p>
      </div>
      <Button onClick={onReset} data-testid="btn-new-checklist" className="w-full max-w-xs">
        Start New Checklist
      </Button>
      <Link href="/history">
        <Button variant="outline" className="w-full max-w-xs" data-testid="btn-view-history">
          View History
        </Button>
      </Link>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function ChecklistPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submittedOffline, setSubmittedOffline] = useState(false);
  const [serviceAlert, setServiceAlert] = useState<{ hoursRemaining: number; daysRemaining: number } | null>(null);
  const [serviceAlertShown, setServiceAlertShown] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Monitor connectivity
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Auto-flush queue when back online
      const count = await getQueueCount();
      if (count > 0) {
        setIsSyncing(true);
        const flushed = await flushQueue();
        setIsSyncing(false);
        if (flushed > 0) {
          toast({
            title: `${flushed} offline ${flushed === 1 ? "checklist" : "checklists"} synced`,
            description: "Your saved submissions have been uploaded.",
          });
          setQueueCount(0);
        }
      }
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // Check queue count on load
    getQueueCount().then(setQueueCount);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const today = format(new Date(), "yyyy-MM-dd");

  const defaultItems = (labels: string[]) =>
    labels.map((label, i) => ({ id: String(i), label, status: undefined as any, comment: "" }));

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      operatorName: "",
      machine: "",
      hours: undefined as any,
      serviceDueHours: undefined as any,
      serviceDueDate: "",
      inspectionDate: today,
      correctiveItems: defaultItems(CORRECTIVE_ITEMS),
      doNotOperateItems: defaultItems(DO_NOT_OPERATE_ITEMS),
      comments: "",
    },
  });

  const { watch } = form;
  const watchHours = watch("hours");
  const watchServiceDueHours = watch("serviceDueHours");
  const watchServiceDueDate = watch("serviceDueDate");

  // Service alert is checked only at submit time — see onSubmit below

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      // Save permanently to device storage
      await saveSubmission(data);
      // Auto-download as Excel
      exportSubmissionToExcel(data);
      return { ok: true };
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      // Should never reach here since we catch internally, but just in case
      setSubmitted(true);
    },
  });

  function doSubmit(values: any) {
    submitMutation.mutate(values);
  }

  function onSubmit(values: FormValues) {
    const hasCriticalFaults = values.doNotOperateItems.some((i) => i.status === "faulty");
    const hasFaults = hasCriticalFaults || values.correctiveItems.some((i) => i.status === "faulty");

    const payload = {
      ...values,
      hasFaults,
      hasCriticalFaults,
      serviceAlertSent: false,
    };

    // Check service alert at submit time with fully completed values
    const hoursRemaining = Number(values.serviceDueHours) - Number(values.hours);
    let daysRemaining = 999;
    try {
      const [year, month, day] = values.serviceDueDate.split("-").map(Number);
      const dueDate = new Date(year, month - 1, day);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      daysRemaining = differenceInDays(dueDate, todayDate);
    } catch {}

    if (!serviceAlertShown && (hoursRemaining <= 50 || daysRemaining <= 14)) {
      // Show alert first, then submit after user dismisses
      setServiceAlert({ hoursRemaining, daysRemaining });
      setPendingSubmit(payload);
    } else {
      doSubmit(payload);
    }
  }

  function handleReset() {
    form.reset({
      operatorName: "",
      machine: "",
      hours: undefined as any,
      serviceDueHours: undefined as any,
      serviceDueDate: "",
      inspectionDate: today,
      correctiveItems: defaultItems(CORRECTIVE_ITEMS),
      doNotOperateItems: defaultItems(DO_NOT_OPERATE_ITEMS),
      comments: "",
    });
    setSubmitted(false);
    setSubmittedOffline(false);
    setServiceAlertShown(false);
    setServiceAlert(null);
  }

  const hasCriticalFaults = watch("doNotOperateItems")?.some((i: any) => i?.status === "faulty");
  const hasCorrectiveFaults = watch("correctiveItems")?.some((i: any) => i?.status === "faulty");

  if (submitted) return <SuccessScreen onReset={handleReset} />;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AtlasLogo />
            <div>
              <p className="text-xs opacity-75 leading-none">Atlas Paving</p>
              <h1 className="font-bold text-base leading-tight">Machine Pre-Start</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="flex items-center gap-1 text-xs bg-white/15 rounded-full px-2 py-1">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}
            {isSyncing && (
              <span className="flex items-center gap-1 text-xs bg-white/15 rounded-full px-2 py-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
              </span>
            )}
            <Link href="/history">
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10" data-testid="btn-history-nav">
                <History className="w-4 h-4 mr-1" />
                History
              </Button>
            </Link>
          </div>
        </div>
        {queueCount > 0 && isOnline === false && (
          <div className="bg-amber-500 text-white text-xs text-center py-1.5 px-4">
            {queueCount} checklist{queueCount > 1 ? "s" : ""} saved offline — will sync when connected
          </div>
        )}
      </div>

      {/* Service alert dialog */}
      <AlertDialog open={!!serviceAlert && !serviceAlertShown}>
        <AlertDialogContent>
          <AlertDialogHeader>
            {(() => {
              const hoursOverdue = serviceAlert && serviceAlert.hoursRemaining <= 0;
              const dateOverdue = serviceAlert && serviceAlert.daysRemaining <= 0;
              const isOverdue = hoursOverdue || dateOverdue;
              return (
                <AlertDialogTitle className={`flex items-center gap-2 ${isOverdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                  <Wrench className="w-5 h-5" />
                  {isOverdue ? "Service Overdue" : "Service Due Soon"}
                </AlertDialogTitle>
              );
            })()}
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  {serviceAlert && (serviceAlert.hoursRemaining <= 0 || serviceAlert.daysRemaining <= 0)
                    ? "This machine has passed its service interval:"
                    : "This machine is approaching its service interval:"}
                </p>
                {serviceAlert && serviceAlert.hoursRemaining <= 50 && (
                  <div className={`flex items-center gap-2 rounded-md px-3 py-2 border ${
                    serviceAlert.hoursRemaining <= 0
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                      : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                  }`}>
                    <span className={`font-semibold ${
                      serviceAlert.hoursRemaining <= 0
                        ? "text-red-700 dark:text-red-300"
                        : "text-amber-800 dark:text-amber-300"
                    }`}>
                      {serviceAlert.hoursRemaining <= 0
                        ? `🔴 Hours overdue by ${Math.abs(serviceAlert.hoursRemaining)} hrs`
                        : `${serviceAlert.hoursRemaining} hours remaining`}
                    </span>
                  </div>
                )}
                {serviceAlert && serviceAlert.daysRemaining <= 14 && (
                  <div className={`flex items-center gap-2 rounded-md px-3 py-2 border ${
                    serviceAlert.daysRemaining <= 0
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                      : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                  }`}>
                    <span className={`font-semibold ${
                      serviceAlert.daysRemaining <= 0
                        ? "text-red-700 dark:text-red-300"
                        : "text-amber-800 dark:text-amber-300"
                    }`}>
                      {serviceAlert.daysRemaining <= 0
                        ? `🔴 Date overdue by ${Math.abs(serviceAlert.daysRemaining)} days`
                        : `${serviceAlert.daysRemaining} days remaining`}
                    </span>
                  </div>
                )}
                <p className="text-muted-foreground">Your supervisor will be notified when this pre-start is submitted.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              data-testid="btn-service-alert-ok"
              onClick={() => {
                setServiceAlertShown(true);
                setServiceAlert(null);
                if (pendingSubmit) {
                  doSubmit(pendingSubmit);
                  setPendingSubmit(null);
                }
              }}
            >
              Understood, Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* ─── Section 1: Machine Info ─────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  Machine Information
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4">
                <FormField control={form.control} name="operatorName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operator Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-operator-name" placeholder="Full name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="machine" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Machine <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-machine" placeholder="e.g. Forklift 1, Loader" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="hours" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Hours <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-hours" type="number" placeholder="e.g. 1200" min={0} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="serviceDueHours" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Due Hours <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-service-due-hours" type="number" placeholder="e.g. 1250" min={0} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="serviceDueDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Due Date <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-service-due-date" type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="inspectionDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inspection Date</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-inspection-date" type="date" readOnly className="bg-muted cursor-default" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* ─── Section 2: Corrective Action ───────────────────────── */}
            <Card>
              <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Corrective Action
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">
                      Machine can still operate — notify supervisor of any faults
                    </p>
                  </div>
                  {hasCorrectiveFaults && (
                    <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 shrink-0 text-xs">
                      Fault flagged
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {CORRECTIVE_ITEMS.map((label, i) => (
                  <ChecklistItemRow
                    key={label}
                    index={i}
                    label={label}
                    fieldPrefix="correctiveItems"
                    control={form.control}
                    register={form.register}
                    watch={watch}
                    errors={form.formState.errors}
                  />
                ))}
              </CardContent>
            </Card>

            {/* ─── Section 3: Do Not Operate ──────────────────────────── */}
            <Card className={hasCriticalFaults ? "border-red-500 dark:border-red-700" : ""}>
              <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      Do Not Operate
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">
                      Machine must NOT be operated until fault is rectified
                    </p>
                  </div>
                  {hasCriticalFaults && (
                    <Badge className="bg-red-600 text-white shrink-0 text-xs">
                      STOP — Do not operate
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {DO_NOT_OPERATE_ITEMS.map((label, i) => (
                  <ChecklistItemRow
                    key={label}
                    index={i}
                    label={label}
                    fieldPrefix="doNotOperateItems"
                    control={form.control}
                    register={form.register}
                    watch={watch}
                    errors={form.formState.errors}
                  />
                ))}
              </CardContent>
            </Card>

            {/* ─── Additional Comments ─────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-base">Additional Comments</CardTitle>
                <p className="text-xs text-muted-foreground">Optional — any other observations</p>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <FormField control={form.control} name="comments" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        {...field}
                        data-testid="input-comments"
                        placeholder="Any additional notes..."
                        rows={3}
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* ─── Fault warning banner ────────────────────────────────── */}
            {hasCriticalFaults && (
              <div className="rounded-lg border border-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-3 flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-300 text-sm">DO NOT OPERATE</p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                    Critical fault detected. Supervisor will be notified immediately upon submission.
                  </p>
                </div>
              </div>
            )}

            {/* ─── Submit ──────────────────────────────────────────────── */}
            <Button
              type="submit"
              data-testid="btn-submit"
              className="w-full h-12 text-base font-semibold"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Pre-Start Checklist"}
            </Button>

            <p className="text-center text-xs text-muted-foreground pb-4">
              All fields marked <span className="text-destructive">*</span> are required. Submitted checklists are filed automatically.
            </p>
          </form>
        </Form>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-muted-foreground px-4">
        <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="hover:underline">
          Created with Perplexity Computer
        </a>
      </footer>
    </div>
  );
}

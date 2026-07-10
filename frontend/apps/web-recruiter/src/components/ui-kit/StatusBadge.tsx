import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "muted" | "ai" | "primary";

const STATUS_MAP: Record<string, Tone> = {
  // applications — real API enum labels (Vietnamese)
  "Chờ duyệt": "warning",
  "Đang xét": "info",
  "Chấp nhận": "success",
  "Từ chối": "danger",
  "Đã rút": "muted",
  // applications — legacy mock labels
  Qualified: "success",
  Accepted: "success",
  "Offer Sent": "success",
  "Under Review": "warning",
  "Pending Review": "warning",
  "Interview Scheduled": "info",
  Interviewed: "info",
  "Not Qualified": "danger",
  Rejected: "danger",
  // jobs
  Active: "success",
  Draft: "muted",
  "Pending Approval": "warning",
  Closed: "muted",
  // payments
  Paid: "success",
  Pending: "warning",
  Failed: "danger",
  Cancelled: "danger",
  Refunded: "muted",
  // verification
  Verified: "success",
  "Pending Verification": "warning",
  "Not Submitted": "muted",
  // assessments
  "Not started": "muted",
  "In progress": "info",
  Submitted: "success",
  Expired: "danger",
  Parsed: "success",
  Processing: "warning",
  // users
  Locked: "danger",
};

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  info: "bg-blue-50 text-brand-blue border-brand-blue/20",
  muted: "bg-muted text-muted-foreground border-border",
  ai: "bg-ai-soft text-ai border-ai/20",
  primary: "bg-primary/10 text-primary border-primary/20",
};

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string;
  tone?: Tone;
  className?: string;
}) {
  const finalTone = tone ?? STATUS_MAP[status] ?? "muted";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[finalTone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { CANDIDATES } from "@/lib/mock-data";
import { AIScoreRing } from "@/components/ui-kit/AIScoreRing";
import { useState } from "react";
import { toast } from "sonner";

const COLUMNS = ["Qualified", "Interview Scheduled", "Interviewed", "Offer Sent", "Accepted", "Rejected"] as const;
type Col = typeof COLUMNS[number];

export const Route = createFileRoute("/employer/ats")({
  head: () => ({ meta: [{ title: "Bảng ATS" }] }),
  component: ATSBoard,
});

function ATSBoard() {
  const [board, setBoard] = useState<Record<Col, typeof CANDIDATES>>(() => {
    const init: Record<string, typeof CANDIDATES> = { Qualified: [], "Interview Scheduled": [], Interviewed: [], "Offer Sent": [], Accepted: [], Rejected: [] };
    CANDIDATES.forEach((c) => {
      const col: Col = c.status === "Offer Sent" ? "Offer Sent"
        : c.status === "Interview Scheduled" ? "Interview Scheduled"
        : c.status === "Qualified" ? "Qualified"
        : c.status === "Interviewed" ? "Interviewed"
        : c.status === "Accepted" ? "Accepted"
        : "Rejected";
      init[col].push(c);
    });
    // Add some duplicates so board feels full
    init["Interviewed"].push({ ...CANDIDATES[0], id: "c1b" });
    init["Accepted"].push({ ...CANDIDATES[3], id: "c4b" });
    return init as Record<Col, typeof CANDIDATES>;
  });

  const move = (from: Col, to: Col, idx: number) => {
    if (from === to) return;
    if (!confirm(`Chuyển ứng viên sang "${to}"?`)) return;
    setBoard((b) => {
      const item = b[from][idx];
      return { ...b, [from]: b[from].filter((_, i) => i !== idx), [to]: [...b[to], item] };
    });
    toast.success(`Đã chuyển sang ${to}`);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Bảng ATS</h1>
        <p className="text-sm text-muted-foreground">Kéo thả ứng viên giữa các giai đoạn (demo: bấm để di chuyển)</p>
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-6 gap-3 min-w-[1100px]">
          {COLUMNS.map((col) => (
            <div key={col} className="rounded-xl bg-secondary/50 p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="font-semibold text-sm">{col}</div>
                <span className="text-xs rounded-full bg-card border border-border px-2">{board[col].length}</span>
              </div>
              <div className="space-y-2">
                {board[col].map((c, idx) => (
                  <div key={c.id} className="card-surface p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                        {c.name.split(" ").pop()?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.appliedJob}</div>
                      </div>
                      <AIScoreRing score={c.score} size={36} thickness={4} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {c.skills.slice(0, 2).map((s) => (
                        <span key={s} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                    <select
                      onChange={(e) => move(col, e.target.value as Col, idx)}
                      defaultValue=""
                      className="w-full text-xs h-7 rounded border border-border bg-background px-1"
                    >
                      <option value="" disabled>Chuyển sang...</option>
                      {COLUMNS.filter((c) => c !== col).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

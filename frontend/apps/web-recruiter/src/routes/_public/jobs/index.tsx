import { createFileRoute, Link } from "@tanstack/react-router";
import { JOBS } from "@/lib/mock-data";
import { Building2, MapPin, Clock, Search, Filter } from "lucide-react";

export const Route = createFileRoute("/_public/jobs/")({
  head: () => ({ meta: [{ title: "Tìm việc — SmartCV" }] }),
  component: JobsList,
});

function JobsList() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 grid lg:grid-cols-[280px_1fr] gap-6">
      <aside className="card-surface p-5 h-fit sticky top-20 space-y-5">
        <h3 className="font-semibold flex items-center gap-2"><Filter className="size-4" /> Bộ lọc</h3>
        {[
          { label: "Từ khoá", type: "input" },
          { label: "Địa điểm", type: "input" },
          { label: "Loại hình", type: "select", opts: ["Full-time", "Part-time", "Contract"] },
          { label: "Kinh nghiệm", type: "select", opts: ["0-1 năm", "1-3 năm", "3-5 năm", "5+ năm"] },
          { label: "Mức lương", type: "select", opts: ["< 15M", "15-25M", "25-40M", "> 40M"] },
          { label: "Hình thức", type: "select", opts: ["Onsite", "Remote", "Hybrid"] },
          { label: "Công ty", type: "select", opts: ["FPT Software", "VNG", "Tiki", "MoMo"] },
        ].map((f) => (
          <div key={f.label}>
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            {f.type === "input" ? (
              <input className="mt-1 w-full h-9 rounded-md border border-input px-3 text-sm bg-background" />
            ) : (
              <select className="mt-1 w-full h-9 rounded-md border border-input px-2 text-sm bg-background">
                <option>Tất cả</option>
                {f.opts?.map((o) => <option key={o}>{o}</option>)}
              </select>
            )}
          </div>
        ))}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Kỹ năng</label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Java", "React", "Python", "AWS", "Docker"].map((s) => (
              <span key={s} className="text-xs rounded-full border border-border px-2 py-0.5 cursor-pointer hover:bg-accent">{s}</span>
            ))}
          </div>
        </div>
      </aside>

      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold">Tìm việc làm</h1>
            <p className="text-sm text-muted-foreground">{JOBS.length} việc làm phù hợp</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input placeholder="Tìm kiếm..." className="h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm w-64" />
          </div>
        </div>

        <div className="space-y-3">
          {JOBS.map((j) => (
            <Link key={j.id} to="/jobs/$id" params={{ id: j.id }}
              className="card-surface p-5 flex gap-4 hover:border-primary/30 hover:shadow-md transition-all">
              <div className="size-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Building2 className="size-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{j.title}</div>
                    <div className="text-sm text-muted-foreground">{j.company}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-success">{j.salary}</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="size-3" /> {j.location}</span>
                  <span className="flex items-center gap-1"><Clock className="size-3" /> {j.postedDays} ngày</span>
                  <span className="rounded-md bg-secondary px-2 py-0.5">{j.mode}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {j.skills.map((s) => (
                    <span key={s} className="text-xs bg-secondary px-2 py-0.5 rounded-md">{s}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

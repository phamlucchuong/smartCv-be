import { createFileRoute, Link } from "@tanstack/react-router";
import { JOBS } from "@/lib/mock-data";
import { Building2, MapPin, DollarSign, Clock, Briefcase, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@smart-cv/ui";
import { AIInsightBox } from "@/components/ui-kit/AIInsightBox";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";

export const Route = createFileRoute("/_public/jobs/$id")({
  head: () => ({ meta: [{ title: "Chi tiết việc làm — SmartCV" }] }),
  notFoundComponent: () => <div className="p-10 text-center">Không tìm thấy việc.</div>,
  errorComponent: () => <div className="p-10 text-center">Lỗi tải dữ liệu.</div>,
  component: JobDetail,
});

function JobDetail() {
  const { id } = Route.useParams();
  const job = JOBS.find((j) => j.id === id) ?? JOBS[0];
  const similar = JOBS.filter((j) => j.id !== job.id).slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 grid lg:grid-cols-[1fr_340px] gap-6">
      <div className="space-y-6">
        <div className="card-surface p-6">
          <div className="flex items-start gap-4">
            <div className="size-14 rounded-xl bg-muted flex items-center justify-center">
              <Building2 className="size-7 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{job.title}</h1>
              <div className="text-muted-foreground">{job.company}</div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5"><MapPin className="size-4 text-muted-foreground" /> {job.location}</span>
                <span className="flex items-center gap-1.5"><DollarSign className="size-4 text-muted-foreground" /> {job.salary}</span>
                <span className="flex items-center gap-1.5"><Briefcase className="size-4 text-muted-foreground" /> {job.type}</span>
                <span className="flex items-center gap-1.5"><Clock className="size-4 text-muted-foreground" /> {job.postedDays} ngày trước</span>
                {job.assessmentRequired && <StatusBadge status="Yêu cầu bài test" tone="ai" />}
              </div>
            </div>
          </div>
        </div>

        <Section title="Mô tả công việc">
          <p className="text-sm leading-relaxed text-foreground/80">{job.description}</p>
        </Section>

        <Section title="Trách nhiệm">
          <ul className="space-y-2 text-sm">
            {job.responsibilities.map((r) => (
              <li key={r} className="flex gap-2"><CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" /> {r}</li>
            ))}
          </ul>
        </Section>

        <Section title="Yêu cầu">
          <ul className="space-y-2 text-sm">
            {job.requirements.map((r) => (
              <li key={r} className="flex gap-2"><CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" /> {r}</li>
            ))}
          </ul>
        </Section>

        <Section title="Quyền lợi">
          <div className="grid sm:grid-cols-2 gap-2">
            {job.benefits.map((b) => (
              <div key={b} className="flex items-center gap-2 text-sm rounded-lg bg-secondary px-3 py-2">
                <Sparkles className="size-4 text-ai" /> {b}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Kỹ năng yêu cầu">
          <div className="flex flex-wrap gap-2">
            {job.skills.map((s) => (
              <span key={s} className="text-sm rounded-full border border-border bg-secondary px-3 py-1">{s}</span>
            ))}
          </div>
        </Section>
      </div>

      {/* Sticky sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-20 self-start">
        <div className="card-surface p-5 space-y-3">
          <Link to="/login">
            <Button className="w-full" size="lg">Ứng tuyển ngay</Button>
          </Link>
          <Link to="/login">
            <Button variant="outline" className="w-full gap-2">
              <Sparkles className="size-4 text-ai" /> Phân tích với CV của tôi
            </Button>
          </Link>
        </div>

        <AIInsightBox title="AI Match Score">
          Đăng nhập và chọn CV để xem điểm phù hợp tự động.
        </AIInsightBox>

        <div className="card-surface p-5">
          <h3 className="font-semibold mb-3">Về công ty</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <div><strong className="text-foreground">{job.company}</strong></div>
            <div>Công nghệ • 1000+ nhân viên</div>
            <div>Trụ sở: {job.location}</div>
          </div>
        </div>

        <div className="card-surface p-5">
          <h3 className="font-semibold mb-3">Việc tương tự</h3>
          <div className="space-y-3">
            {similar.map((s) => (
              <Link key={s.id} to="/jobs/$id" params={{ id: s.id }} className="block rounded-lg p-2 -mx-2 hover:bg-accent">
                <div className="font-medium text-sm">{s.title}</div>
                <div className="text-xs text-muted-foreground">{s.company} • {s.salary}</div>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-6">
      <h2 className="font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

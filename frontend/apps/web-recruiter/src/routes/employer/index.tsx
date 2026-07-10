import { createFileRoute, Link } from "@tanstack/react-router";
import { AIScoreRing } from "@/components/ui-kit/AIScoreRing";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { AIInsightBox } from "@/components/ui-kit/AIInsightBox";
import { Briefcase, Users, CheckCircle2, AlertCircle, TrendingUp, DollarSign } from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid,
} from "recharts";
import { useGetMyJobs, useGetRecruiterApplications, RecruiterApi, useGetCandidateByUserId } from "@smart-cv/api";
import type { ApplicationModels } from "@smart-cv/api";

export const Route = createFileRoute("/employer/")({
  head: () => ({ meta: [{ title: "Tổng quan — Nhà tuyển dụng" }] }),
  component: EmployerDashboard,
});

function RecentApplicantRow({ application }: { application: ApplicationModels.ApplicationDetailResponse }) {
  const { data: candidateData } = useGetCandidateByUserId(application.candidateId ?? "", {
    query: { enabled: !!application.candidateId, staleTime: 60_000 },
  });
  const candidate = candidateData?.data;

  return (
    <Link to="/employer/applicants/$id" params={{ id: application.id ?? "" }} className="block">
      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
        <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
          {candidate?.fullName?.split(" ").pop()?.[0] ?? "U"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{candidate?.fullName ?? "..."}</div>
          <div className="text-xs text-muted-foreground truncate">{application.jobTitle}</div>
        </div>
        <AIScoreRing score={application.aiScore ?? 0} size={42} thickness={5} />
        <StatusBadge status={application.status ?? "PENDING"} />
      </div>
    </Link>
  );
}

function EmployerDashboard() {
  const { data: meData } = RecruiterApi.useGetMe1();
  const recruiter = meData?.data;

  const { data: jobsData, isLoading: isJobsLoading } = useGetMyJobs({ page: 1, size: 100 });
  const { data: appsData, isLoading: isAppsLoading } = useGetRecruiterApplications({ page: 1, size: 100 });

  if (isJobsLoading || isAppsLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const jobs = jobsData?.data?.items ?? [];
  const applications = appsData?.data?.items ?? [];

  const activeJobsCount = jobs.filter((j) => j.visibilityStatus === "ACTIVE").length;
  const totalApplicantsCount = applications.length;
  const qualifiedCount = applications.filter((app) => app.status === "ACCEPTED").length;
  const reviewNeededCount = applications.filter((app) => app.status === "PENDING" || app.status === "REVIEWING").length;

  const daysOfWeek = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const last7Days = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    return d;
  });

  const appData = last7Days.map((d) => {
    const dayLabel = daysOfWeek[d.getDay()];
    const count = applications.filter((app) => {
      if (!app.appliedAt) return false;
      const appDate = new Date(app.appliedAt);
      return appDate.toDateString() === d.toDateString();
    }).length;
    return { day: dayLabel, apps: count };
  });

  const funnelData = [
    { stage: "Applied", v: applications.length },
    { stage: "Reviewing", v: applications.filter((a) => a.status === "REVIEWING").length },
    { stage: "Accepted", v: applications.filter((a) => a.status === "ACCEPTED").length },
    { stage: "Rejected", v: applications.filter((a) => a.status === "REJECTED").length },
    { stage: "Withdrawn", v: applications.filter((a) => a.status === "WITHDRAWN").length },
  ];

  const recentApplicants = [...applications]
    .sort((a, b) => new Date(b.appliedAt ?? 0).getTime() - new Date(a.appliedAt ?? 0).getTime())
    .slice(0, 5);

  const autoQualifiedCount = applications.filter((a) => a.aiScore != null && a.aiScore >= 80).length;
  const autoRejectedCount = applications.filter((a) => a.aiScore != null && a.aiScore < 40).length;
  const manualReviewCount = applications.filter((a) => a.aiScore != null && a.aiScore >= 40 && a.aiScore < 80).length;
  const avgScore = applications.length > 0
    ? Math.round(applications.reduce((acc, a) => acc + (a.aiScore ?? 0), 0) / applications.length)
    : 0;

  const pendingByJobMap = new Map<string, number>();
  applications.forEach((app) => {
    if ((app.status === "PENDING" || app.status === "REVIEWING") && app.jobTitle) {
      pendingByJobMap.set(app.jobTitle, (pendingByJobMap.get(app.jobTitle) ?? 0) + 1);
    }
  });
  const jobsNeedingAttention = Array.from(pendingByJobMap.entries())
    .map(([title, count]) => ({ title, count }))
    .slice(0, 3);

  const kpis = [
    { icon: Briefcase, label: "Việc đang đăng", value: activeJobsCount.toString(), color: "primary" },
    { icon: Users, label: "Ứng viên", value: totalApplicantsCount.toString(), color: "primary" },
    { icon: CheckCircle2, label: "Đạt yêu cầu", value: qualifiedCount.toString(), color: "success" },
    { icon: AlertCircle, label: "Cần review", value: reviewNeededCount.toString(), color: "warning" },
    { icon: TrendingUp, label: "Sử dụng gói", value: "62%", color: "primary" },
    { icon: DollarSign, label: "Chi tháng này", value: "12M₫", color: "primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tổng quan tuyển dụng</h1>
          <p className="text-sm text-muted-foreground">
            {recruiter?.companyName ?? "Công ty của tôi"} •{" "}
            {recruiter?.status === "APPROVED" ? (
              <span className="text-success font-medium">Đã xác minh ✓</span>
            ) : (
              <span className="text-warning font-medium">Chưa xác minh</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="card-surface p-4">
            <k.icon className={`size-5 ${k.color === "success" ? "text-success" : k.color === "warning" ? "text-warning" : "text-primary"}`} />
            <div className="mt-2 text-2xl font-bold">{k.value}</div>
            <div className="text-xs text-muted-foreground">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card-surface p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4">Đơn ứng tuyển theo ngày</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={appData}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
              <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
              <Tooltip />
              <Line type="monotone" dataKey="apps" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card-surface p-5">
          <h2 className="font-semibold mb-4">Phễu tuyển dụng</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={70} />
              <Tooltip />
              <Bar dataKey="v" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card-surface p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">Ứng viên gần đây</h2>
            <Link to="/employer/applicants" className="text-xs text-primary">Xem tất cả →</Link>
          </div>
          <div className="space-y-2">
            {recentApplicants.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Chưa có ứng viên nào ứng tuyển</p>
            ) : (
              recentApplicants.map((c) => (
                <RecentApplicantRow key={c.id} application={c} />
              ))
            )}
          </div>
        </div>
        <div className="space-y-4">
          <AIInsightBox title="AI Screening Summary">
            <div className="space-y-1.5">
              <div className="flex justify-between"><span>Auto-qualified (Score &gt;= 80)</span><strong className="text-success">{autoQualifiedCount}</strong></div>
              <div className="flex justify-between"><span>Manual review</span><strong className="text-warning">{manualReviewCount}</strong></div>
              <div className="flex justify-between"><span>Auto-rejected (Score &lt; 40)</span><strong className="text-danger">{autoRejectedCount}</strong></div>
              <div className="flex justify-between border-t border-ai/20 pt-2 mt-2"><span>Average match score</span><strong>{avgScore}%</strong></div>
            </div>
          </AIInsightBox>
          <div className="card-surface p-5">
            <h3 className="font-semibold mb-3">Việc cần chú ý</h3>
            <div className="space-y-2 text-sm">
              {jobsNeedingAttention.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Mọi công việc đều đã được xử lý</p>
              ) : (
                jobsNeedingAttention.map((j) => (
                  <div key={j.title} className="flex justify-between p-2 rounded-lg hover:bg-accent">
                    <span className="truncate">{j.title}</span>
                    <span className="text-warning text-xs">{j.count} CV mới</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

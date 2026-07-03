import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useGetMyJobs,
  useGetByJobId,
  useGetRecruiterApplications,
  useUpdateStatus,
  useGetCandidateByUserId,
  getGetByJobIdQueryKey,
  getRecruiterApplicationsQueryKey,
} from "@smart-cv/api";
import type { ApplicationModels } from "@smart-cv/api";
import { AIScoreRing } from "@/components/ui-kit/AIScoreRing";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Button } from "@smart-cv/ui";
import { Search, Download, List, Kanban, Briefcase, Mail, Phone, Calendar, Award, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "../../../store/useAuthStore";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/employer/applicants/")({
  head: () => ({ meta: [{ title: "Ứng viên" }] }),
  component: ApplicantsPage,
});

const STATUS_COLUMNS = [
  "PENDING",
  "REVIEWING",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
] as const;
type ApplicationStatus = (typeof STATUS_COLUMNS)[number];

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: "Chờ duyệt",
  REVIEWING: "Đang xét",
  ACCEPTED: "Chấp nhận",
  REJECTED: "Từ chối",
  WITHDRAWN: "Đã rút",
};

type AppItem = ApplicationModels.ApplicationDetailResponse;

function ApplicationKanbanCard({
  application,
  onDragStart,
  statusOverride,
}: {
  application: AppItem;
  onDragStart: (e: React.DragEvent, id: string, fromStatus: string) => void;
  statusOverride?: string;
}) {
  const { data: candidateData } = useGetCandidateByUserId(application.candidateId ?? "", {
    query: { enabled: !!application.candidateId, staleTime: 60_000 },
  });
  const candidate = candidateData?.data;
  const effectiveStatus = statusOverride ?? application.status ?? "PENDING";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, application.id ?? "", effectiveStatus)}
      className="card-surface group flex h-[196px] cursor-grab flex-col rounded-xl border border-border/50 bg-card p-3.5 transition-all duration-300 hover:border-primary/40 hover:shadow-xl active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 flex-1 min-w-0">
          <Link
            to="/employer/applicants/$id"
            params={{ id: application.id ?? "" }}
            className="font-semibold text-sm hover:text-primary line-clamp-1 block transition-colors text-foreground"
          >
            {candidate?.fullName ?? "..."}
          </Link>
          <div className="text-xs text-muted-foreground font-medium line-clamp-1">
            {candidate?.title ?? "Chưa cập nhật tiêu đề"}
          </div>
        </div>
        <AIScoreRing score={application.aiScore ?? 0} size={32} thickness={3} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {application.jobTitle ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-primary/10 bg-primary/5 px-2 py-1 text-xs text-primary/90">
            <Briefcase className="size-3.5 flex-shrink-0" />
            <span className="font-medium line-clamp-1">{application.jobTitle}</span>
          </div>
        ) : <div className="flex-1" />}
        <StatusBadge className="shrink-0" status={STATUS_LABELS[effectiveStatus as ApplicationStatus] ?? effectiveStatus} />
      </div>

      <div className="mt-3 space-y-1.5 border-t border-border/30 pt-2 text-[11px] text-muted-foreground">
        {candidate?.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="size-3 flex-shrink-0" />
            <span className="truncate">{candidate.email}</span>
          </div>
        )}
        {candidate?.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="size-3 flex-shrink-0" />
            <span>{candidate.phone}</span>
          </div>
        )}
        {candidate?.yearsOfExperience != null && (
          <div className="flex items-center gap-1.5">
            <Award className="size-3 flex-shrink-0" />
            <span>Kinh nghiệm: {candidate.yearsOfExperience} năm</span>
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border/30 pt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1 min-w-0">
          <Calendar className="size-3" />
          {application.appliedAt
            ? new Date(application.appliedAt).toLocaleDateString("vi-VN")
            : "—"}
        </span>
        <Link to="/employer/applicants/$id" params={{ id: application.id ?? "" }}>
          <Button size="icon" variant="outline" className="h-7 w-7">
            <Eye className="size-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ApplicationListRow({ application }: { application: AppItem }) {
  const { data: candidateData } = useGetCandidateByUserId(application.candidateId ?? "", {
    query: { enabled: !!application.candidateId, staleTime: 60_000 },
  });
  const candidate = candidateData?.data;
  const status = (application.status ?? "PENDING") as ApplicationStatus;

  return (
    <tr className="border-t border-border hover:bg-accent/30">
      <td className="py-3 px-4">
        <input type="checkbox" />
      </td>
      <td className="py-3 px-4">
        <Link
          to="/employer/applicants/$id"
          params={{ id: application.id ?? "" }}
          className="font-medium hover:text-primary"
        >
          {candidate?.fullName ?? "..."}
        </Link>
        <div className="text-xs text-muted-foreground">{candidate?.title ?? "—"}</div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <AIScoreRing score={application.aiScore ?? 0} size={36} thickness={4} />
          <span
            className={`text-xs font-semibold ${(application.aiScore ?? 0) >= 70 ? "text-success" : "text-warning"}`}
          >
            {(application.aiScore ?? 0) >= 70 ? "Đạt" : "Xem xét"}
          </span>
        </div>
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={STATUS_LABELS[status] ?? status} />
      </td>
      <td className="py-3 px-4 text-xs text-muted-foreground">
        {(application.missingSkills ?? []).join(", ")}
      </td>
      <td className="py-3 px-4 text-muted-foreground">
        {application.appliedAt
          ? new Date(application.appliedAt).toLocaleDateString("vi-VN")
          : "—"}
      </td>
      <td className="py-3 px-4 text-right">
        <Link to="/employer/applicants/$id" params={{ id: application.id ?? "" }}>
          <Button size="sm" variant="ghost">
            Xem
          </Button>
        </Link>
      </td>
    </tr>
  );
}

function ApplicantsPage() {
  const { isAuthenticated, role } = useAuthStore();
  const isRecruiter = isAuthenticated && (role?.includes("RECRUITER") ?? false);
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");
  const [selectedJobId, setSelectedJobId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("Tất cả trạng thái");
  const [selectedScore, setSelectedScore] = useState("Mọi điểm số");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});

  const { data: myJobsData } = useGetMyJobs(undefined, {
    query: { enabled: isRecruiter },
  });
  const myJobs = myJobsData?.data?.items ?? [];

  const isAllSelected = selectedJobId === "all";

  const { data: allApplicationsData, isLoading: isAllAppsLoading } = useGetRecruiterApplications(
    { page: 1, size: 200 },
    { query: { enabled: isRecruiter && isAllSelected } },
  );

  const { data: jobApplicationsData, isLoading: isJobAppsLoading } = useGetByJobId(
    selectedJobId,
    { page: 1, size: 50 },
    { query: { enabled: !isAllSelected && !!selectedJobId } },
  );

  const isAppsLoading = isAllSelected ? isAllAppsLoading : isJobAppsLoading;
  const applications = isAllSelected
    ? (allApplicationsData?.data?.items ?? [])
    : (jobApplicationsData?.data?.items ?? []);

  const updateStatusMutation = useUpdateStatus();

  const filteredApplications = applications.filter((app) => {
    const effectiveStatus =
      statusOverrides[app.id ?? ""] ?? app.status ?? "PENDING";
    const matchesStatus =
      selectedStatus === "Tất cả trạng thái" ||
      STATUS_LABELS[effectiveStatus as ApplicationStatus] === selectedStatus ||
      effectiveStatus === selectedStatus;
    const score = app.aiScore ?? 0;
    const matchesScore =
      selectedScore === "Mọi điểm số" ||
      (selectedScore === "≥ 80%" && score >= 80) ||
      (selectedScore === "70-79%" && score >= 70 && score < 80);
    const matchesSearch =
      !searchQuery.trim() ||
      (app.matchedSkills ?? []).some((s) =>
        s.toLowerCase().includes(searchQuery.toLowerCase()),
      ) ||
      (app.missingSkills ?? []).some((s) =>
        s.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    return matchesStatus && matchesScore && matchesSearch;
  });

  const handleDragStart = (
    e: React.DragEvent,
    id: string,
    fromStatus: string,
  ) => {
    e.dataTransfer.setData("applicationId", id);
    e.dataTransfer.setData("fromStatus", fromStatus);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, toStatus: ApplicationStatus) => {
    e.preventDefault();
    const applicationId = e.dataTransfer.getData("applicationId");
    const fromStatus = e.dataTransfer.getData("fromStatus");
    if (!applicationId || fromStatus === toStatus) return;

    setStatusOverrides((prev) => ({ ...prev, [applicationId]: toStatus }));
    updateStatusMutation.mutate(
      {
        id: applicationId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { status: toStatus as any },
      },
      {
        onSuccess: () => {
          toast.success(`Đã chuyển sang "${STATUS_LABELS[toStatus]}"`);
          if (isAllSelected) {
            queryClient.invalidateQueries({ queryKey: getRecruiterApplicationsQueryKey() });
          } else {
            queryClient.invalidateQueries({ queryKey: getGetByJobIdQueryKey(selectedJobId) });
          }
          setStatusOverrides((prev) => {
            const n = { ...prev };
            delete n[applicationId];
            return n;
          });
        },
        onError: () => {
          toast.error("Không thể cập nhật trạng thái");
          setStatusOverrides((prev) => {
            const n = { ...prev };
            delete n[applicationId];
            return n;
          });
        },
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ứng viên</h1>
          <p className="text-sm text-muted-foreground">
            {filteredApplications.length} ứng viên
          </p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="size-4" /> Danh sách
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Kanban className="size-4" /> Bảng Kanban
            </button>
          </div>
          <Button variant="outline" className="gap-1">
            <Download className="size-4" /> Xuất danh sách
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card-surface p-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            placeholder="Tìm theo kỹ năng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <select
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background text-sm px-3 cursor-pointer min-w-[200px]"
        >
          <option value="all">Tất cả tin tuyển</option>
          {myJobs.map((j) => (
            <option key={j.id} value={j.id ?? ""}>
              {j.title ?? j.id}
            </option>
          ))}
        </select>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background text-sm px-3 cursor-pointer"
        >
          <option>Tất cả trạng thái</option>
          {STATUS_COLUMNS.map((s) => (
            <option key={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={selectedScore}
          onChange={(e) => setSelectedScore(e.target.value)}
          className="h-9 rounded-md border border-input bg-background text-sm px-3 cursor-pointer"
        >
          <option>Mọi điểm số</option>
          <option>≥ 80%</option>
          <option>70-79%</option>
        </select>
      </div>

      {isAppsLoading ? (
        <div className="grid gap-4 grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl bg-secondary/30 border border-border/40 h-64"
            />
          ))}
        </div>
      ) : viewMode === "kanban" ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1200px]">
            {STATUS_COLUMNS.map((col) => {
              const colApps = filteredApplications.filter(
                (app) =>
                  (statusOverrides[app.id ?? ""] ??
                    app.status ??
                    "PENDING") === col,
              );
              return (
                <div
                  key={col}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col)}
                  className="flex-1 min-w-[200px] rounded-xl bg-secondary/30 border border-border/40 p-3 flex flex-col min-h-[500px]"
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      {STATUS_LABELS[col]}
                    </span>
                    <span className="text-xs font-semibold rounded-full bg-card border border-border px-2 py-0.5">
                      {colApps.length}
                    </span>
                  </div>
                  <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[600px] pr-1">
                    {colApps.map((app) => (
                      <ApplicationKanbanCard
                        key={app.id}
                        application={app}
                        onDragStart={handleDragStart}
                        statusOverride={statusOverrides[app.id ?? ""]}
                      />
                    ))}
                    {colApps.length === 0 && (
                      <div className="h-24 border border-dashed border-border/60 rounded-xl flex items-center justify-center text-xs text-muted-foreground">
                        Kéo thả vào đây
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="text-left py-3 px-4">
                  <input type="checkbox" />
                </th>
                <th className="text-left py-3 px-4">Ứng viên</th>
                <th className="text-left py-3 px-4">Match Score</th>
                <th className="text-left py-3 px-4">Trạng thái</th>
                <th className="text-left py-3 px-4">Kỹ năng thiếu</th>
                <th className="text-left py-3 px-4">Ngày ứng tuyển</th>
                <th className="text-right py-3 px-4">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((app) => (
                <ApplicationListRow key={app.id} application={app} />
              ))}
              {filteredApplications.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    Không có ứng viên nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

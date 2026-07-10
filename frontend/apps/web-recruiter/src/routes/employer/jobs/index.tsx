import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@smart-cv/ui";
import {
  useGetMyJobs,
  useWithdrawJob,
  useActivateJob,
  useDeactivateJob,
  useDeleteJob,
  useGetByJobId,
} from "@smart-cv/api";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { toast } from "sonner";
import { Plus, Search, MoreVertical, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

const DOMAIN_URL = import.meta.env.VITE_DOMAIN_URL ?? 'http://localhost:3000';

type JobItem = {
  id?: string;
  title?: string;
  location?: string;
  company?: string;
  jobType?: string;
  moderationStatus?: string;
  visibilityStatus?: string;
  moderationNote?: string;
  createdAt?: string;
  openings?: number;
};

export const Route = createFileRoute("/employer/jobs/")({
  head: () => ({ meta: [{ title: "Tin tuyển dụng" }] }),
  component: EmployerJobsPage,
});

const MODERATION_STATUS_OPTIONS = [
  { label: "Tất cả trạng thái", value: "" },
  { label: "Nháp", value: "DRAFT" },
  { label: "Chờ duyệt", value: "PENDING" },
  { label: "Đã duyệt", value: "PUBLISHED" },
];

function formatJobStatus(moderationStatus?: string, visibilityStatus?: string) {
  if (moderationStatus === "DRAFT") return "Draft";
  if (moderationStatus === "PENDING") return "Chờ duyệt";
  if (moderationStatus === "PUBLISHED") {
    if (visibilityStatus === "ACTIVE") return "Active";
    if (visibilityStatus === "EXPIRED") return "Expired";
    return "Inactive";
  }
  return "Unknown";
}

function formatJobType(jobType?: string) {
  switch (jobType) {
    case "FULL_TIME":
      return "Full-time";
    case "PART_TIME":
      return "Part-time";
    case "REMOTE":
      return "Remote";
    case "CONTRACT":
      return "Hợp đồng";
    case "INTERNSHIP":
      return "Thực tập";
    default:
      return "Chưa cập nhật";
  }
}

type ApiError = { response?: { data?: { message?: string } } };

function ApplicantCountCell({ jobId, openings }: { jobId: string; openings?: number }) {
  const { data, isLoading } = useGetByJobId(jobId, { page: 1, size: 1 });
  if (isLoading) return <span className="text-muted-foreground text-xs">...</span>;
  const count = data?.data?.total ?? 0;
  return (
    <span className="font-semibold text-foreground">
      {count}/{openings ?? 0}
    </span>
  );
}

function JobActionsMenu({ job, onMutated }: { job: JobItem; onMutated: () => void }) {
  const [isPending, setIsPending] = useState(false);
  const navigate = useNavigate();

  const withdrawMutation = useWithdrawJob();
  const activateMutation = useActivateJob();
  const deactivateMutation = useDeactivateJob();
  const deleteMutation = useDeleteJob();

  const run = async (action: () => Promise<unknown>) => {
    setIsPending(true);
    try {
      await action();
      onMutated();
    } catch (err: unknown) {
      const e = err as ApiError;
      toast.error(e.response?.data?.message ?? "Thao tác thất bại");
    } finally {
      setIsPending(false);
    }
  };

  const isDraft = job.moderationStatus === "DRAFT";
  const isPendingModeration = job.moderationStatus === "PENDING";
  const isPublishedActive = job.moderationStatus === "PUBLISHED" && job.visibilityStatus === "ACTIVE";
  const isPublishedInactive = job.moderationStatus === "PUBLISHED" && job.visibilityStatus === "INACTIVE";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" disabled={isPending}>
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {(isDraft || isPublishedActive || isPublishedInactive) && (
          <DropdownMenuItem
            onClick={() => {
              navigate({ to: "/employer/jobs/$id", params: { id: job.id! } });
            }}
          >
            Chỉnh sửa
          </DropdownMenuItem>
        )}
        {isPendingModeration && (
          <DropdownMenuItem
            onClick={() => {
              navigate({ to: "/employer/jobs/$id", params: { id: job.id! } });
            }}
          >
            Xem chi tiết
          </DropdownMenuItem>
        )}
        {isPendingModeration && (
          <DropdownMenuItem
            className="text-warning focus:text-warning"
            onClick={() => run(() => withdrawMutation.mutateAsync({ id: job.id! }))}
          >
            Rút về nháp
          </DropdownMenuItem>
        )}
        {isPublishedActive && (
          <DropdownMenuItem
            onClick={() => window.open(`${DOMAIN_URL}/jobs/${job.id}`, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="size-4 mr-2" />
            Xem trên trang ứng viên
          </DropdownMenuItem>
        )}
        {isPublishedActive && (
          <DropdownMenuItem
            className="text-warning focus:text-warning"
            onClick={() => run(() => deactivateMutation.mutateAsync({ id: job.id! }))}
          >
            Tạm dừng
          </DropdownMenuItem>
        )}
        {isPublishedInactive && (
          <DropdownMenuItem
            className="text-success focus:text-success"
            onClick={() => run(() => activateMutation.mutateAsync({ id: job.id! }))}
          >
            Kích hoạt lại
          </DropdownMenuItem>
        )}
        {isDraft && (
          <DropdownMenuItem
            className="text-danger focus:text-danger animate-pulse"
            onClick={() => {
              if (!window.confirm("Xóa tin này? Hành động không thể hoàn tác.")) return;
              run(() => deleteMutation.mutateAsync({ id: job.id! }));
            }}
          >
            Xóa
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatDate(date?: string) {
  if (!date) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function EmployerJobsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useGetMyJobs({ page, size: 10 });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search, status]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/jobs/my"], exact: false });
  const jobs = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / 10);

  const filteredJobs = (jobs as JobItem[]).filter((job) => {
    const matchesSearch = !search.trim() ||
      job.title?.toLowerCase().includes(search.trim().toLowerCase()) ||
      job.location?.toLowerCase().includes(search.trim().toLowerCase()) ||
      job.company?.toLowerCase().includes(search.trim().toLowerCase());

    const matchesStatus = !status || job.moderationStatus === status;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tin tuyển dụng</h1>
          <p className="text-sm text-muted-foreground">{total} tin tuyển dụng</p>
        </div>
        <Link to="/employer/jobs/new">
          <Button className="gap-2">
            <Plus className="size-4" /> Đăng tin mới
          </Button>
        </Link>
      </div>

      <div className="card-surface p-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo vị trí, công ty hoặc địa điểm..."
            className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background text-sm px-3"
        >
          {MODERATION_STATUS_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="card-surface p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-14 rounded-lg bg-muted/60 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="card-surface p-6 text-sm flex items-center justify-between">
          <span>Không thể tải danh sách tin tuyển dụng.</span>
          <Button variant="outline" onClick={() => refetch()}>Tải lại</Button>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="card-surface overflow-hidden">
          {filteredJobs.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center">
              Chưa có tin tuyển dụng phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="text-left py-3 px-4">Vị trí</th>
                    <th className="text-left py-3 px-4">Trạng thái</th>
                    <th className="text-right py-3 px-4">Ứng viên</th>
                    <th className="text-left py-3 px-4">Loại hình</th>
                    <th className="text-left py-3 px-4">Ngày tạo</th>
                    <th className="text-right py-3 px-4">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="border-t border-border hover:bg-accent/40">
                      <td className="py-3 px-4">
                        <Link to="/employer/jobs/$id" params={{ id: job.id! }} className="font-medium hover:text-primary">
                          {job.title || "Untitled job"}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {job.location || "Chưa cập nhật"} • {formatJobType(job.jobType)}
                        </div>
                      </td>
                      <td className="py-3 px-4 space-y-0.5">
                        <StatusBadge status={formatJobStatus(job.moderationStatus, job.visibilityStatus)} />
                        {job.moderationStatus === "DRAFT" && job.moderationNote && (
                          <p className="text-xs text-danger">{job.moderationNote}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {job.id ? <ApplicantCountCell jobId={job.id} openings={job.openings} /> : "-"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{formatJobType(job.jobType)}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDate(job.createdAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <JobActionsMenu job={job} onMutated={invalidate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-muted/10 border-t border-border">
                  <div className="flex justify-between flex-1 sm:hidden">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                      disabled={page === 1}
                    >
                      Trước
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={page === totalPages}
                    >
                      Sau
                    </Button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Hiển thị <span className="font-semibold text-foreground">{Math.min((page - 1) * 10 + 1, total)}</span> đến{" "}
                        <span className="font-semibold text-foreground">{Math.min(page * 10, total)}</span> trong số{" "}
                        <span className="font-semibold text-foreground">{total}</span> tin tuyển dụng
                      </p>
                    </div>
                    <div>
                      <nav className="inline-flex -space-x-px rounded-md" aria-label="Pagination">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-r-none h-8 w-8 p-0"
                          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                          disabled={page === 1}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        {Array.from({ length: totalPages }).map((_, index) => {
                          const p = index + 1;
                          return (
                            <Button
                              key={p}
                              variant={p === page ? "default" : "outline"}
                              size="sm"
                              className="rounded-none h-8 w-8 p-0 border-x-0"
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-l-none h-8 w-8 p-0"
                          onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={page === totalPages}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

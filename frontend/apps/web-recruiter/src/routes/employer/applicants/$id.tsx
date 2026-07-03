import { createFileRoute } from '@tanstack/react-router';
import {
  useGetById,
  useGetCandidateByUserId,
  useUpdateStatus,
  getGetByIdQueryKey,
  useGetAttemptsByCandidate,
  useGetRecruiterAssessments,
  useDeleteAttempt,
  getGetAttemptsByCandidateQueryKey,
} from "@smart-cv/api";
import type { ApplicationModels } from "@smart-cv/api";

import { AIScoreRing } from "@/components/ui-kit/AIScoreRing";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { AIInsightBox } from "@/components/ui-kit/AIInsightBox";
import { SkillGapCard } from "@/components/ui-kit/SkillGapCard";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label } from "@smart-cv/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@smart-cv/ui";
import { Mail, Phone, MapPin, FileText, Sparkles, Copy, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/employer/applicants/$id")({
  head: () => ({ meta: [{ title: "Chi tiết ứng viên" }] }),
  component: CandidateDetail,
});

type ApplicationStatus = "PENDING" | "REVIEWING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: "Chờ duyệt",
  REVIEWING: "Đang xét",
  ACCEPTED: "Chấp nhận",
  REJECTED: "Từ chối",
  WITHDRAWN: "Đã rút",
};

const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  PENDING: ["REVIEWING"],
  REVIEWING: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

function CandidateDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: appData, isLoading: appLoading } =
    useGetById<ApplicationModels.ApiResponseApplicationDetailResponse>(id);
  const application = appData?.data;

  const { data: candidateData, isLoading: candidateLoading } = useGetCandidateByUserId(
    application?.candidateId ?? "",
    { query: { enabled: !!application?.candidateId } },
  );
  const candidate = candidateData?.data;

  const { data: attemptsData, isLoading: attemptsLoading } = useGetAttemptsByCandidate(
    application?.candidateId ?? "",
    { query: { enabled: !!application?.candidateId } }
  );
  const attempts = attemptsData?.data ?? [];

  const { data: assessmentsData } = useGetRecruiterAssessments();
  const assessments = assessmentsData?.data ?? [];

  const updateStatusMutation = useUpdateStatus();

  const deleteAttemptMutation = useDeleteAttempt({
    mutation: {
      onSuccess: () => {
        toast.success("Đặt lại bài kiểm tra thành công! Ứng viên có thể thực hiện lại.");
        queryClient.invalidateQueries({
          queryKey: getGetAttemptsByCandidateQueryKey(application?.candidateId ?? ""),
        });
      },
      onError: (err: unknown) => {
        toast.error((err as { message?: string })?.message || "Đặt lại bài kiểm tra thất bại.");
      },
    },
  });

  const status = (application?.status ?? "PENDING") as ApplicationStatus;
  const validTransitions = VALID_TRANSITIONS[status];
  const canReject = validTransitions.includes("REJECTED");

  const doStatusChange = (newStatus: ApplicationStatus, reason?: string) => {
    updateStatusMutation.mutate(
      {
        id,
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: newStatus as any,
          rejectionReason: reason,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Đã chuyển sang "${STATUS_LABELS[newStatus]}"`);
          setShowStatusPicker(false);
          queryClient.invalidateQueries({ queryKey: getGetByIdQueryKey(id) });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => toast.error(err?.response?.data?.message ?? "Không thể cập nhật trạng thái"),
      },
    );
  };

  const handleStatusChange = (newStatus: ApplicationStatus) => {
    if (newStatus === "REJECTED") {
      setRejectDialogOpen(true);
    } else {
      doStatusChange(newStatus);
    }
  };

  const handleConfirmReject = () => {
    if (!rejectionReason.trim()) {
      toast.error("Vui lòng nhập lý do từ chối");
      return;
    }
    doStatusChange("REJECTED", rejectionReason.trim());
    setRejectDialogOpen(false);
    setRejectionReason("");
  };

  const generateQuestions = () => {
    const skills = candidate?.skills ?? [];
    setQuestions([
      `Hãy mô tả kinh nghiệm của bạn với ${skills[0] ?? "công nghệ"} và các dự án đã triển khai.`,
      `Bạn đã tham gia dự án nào có quy mô lớn? Vai trò và đóng góp cụ thể?`,
      `Một bug khó nhất bạn từng debug, bạn đã xử lý như thế nào?`,
      `Khi làm việc với team, bạn xử lý xung đột kỹ thuật ra sao?`,
      `Vì sao bạn muốn ứng tuyển vào vị trí này tại công ty chúng tôi?`,
    ]);
    toast.success("Đã sinh 5 câu hỏi phỏng vấn từ AI");
  };

  if (appLoading || candidateLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl bg-muted/30 h-24" />
        ))}
      </div>
    );
  }

  if (!application) {
    return (
      <div className="card-surface p-12 text-center text-sm text-muted-foreground">
        Không tìm thấy đơn ứng tuyển.
      </div>
    );
  }

  const score = application.aiScore ?? 0;
  const aiStatus = application.aiStatus as string | undefined;
  const isPending = updateStatusMutation.isPending;
  const previewCvUrl = candidate?.cvUrl ?? application.cvUrl;

  return (
    <>
    <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Từ chối ứng viên</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="rejection-reason">Lý do từ chối <span className="text-destructive">*</span></Label>
          <Input
            id="rejection-reason"
            placeholder="Nhập lý do từ chối để thông báo cho ứng viên..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Hủy</Button>
          <Button
            variant="destructive"
            onClick={handleConfirmReject}
            disabled={isPending || !rejectionReason.trim()}
          >
            {isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Xác nhận từ chối
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div className="space-y-5">
      <div className="card-surface p-6 flex flex-col gap-5 md:flex-row md:items-center">
        <div className="size-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
          {candidate?.fullName?.split(" ").pop()?.[0] ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{candidate?.fullName ?? "—"}</h1>
          <div className="text-muted-foreground">{candidate?.title ?? "—"}</div>
          <div className="mt-2 flex flex-nowrap items-center gap-3 overflow-x-auto whitespace-nowrap">
            <StatusBadge status={STATUS_LABELS[status] ?? status} />
          </div>
        </div>
        <AIScoreRing score={score} size={88} />
        <div className="flex flex-col gap-2">
          {validTransitions.length > 0 && (
            <div className="relative">
              <Button
                disabled={isPending}
                onClick={() => setShowStatusPicker((v) => !v)}
              >
                {isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Chuyển stage
              </Button>
              {showStatusPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg p-2 flex flex-col gap-1 min-w-[160px]">
                  {validTransitions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className="text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors cursor-pointer"
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Button variant="outline" disabled>Hẹn phỏng vấn</Button>
          {canReject && (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={isPending}
              onClick={() => setRejectDialogOpen(true)}
            >
              Từ chối
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="cv">CV</TabsTrigger>
          <TabsTrigger value="ai">Phân tích AI</TabsTrigger>
          <TabsTrigger value="test">Bài test</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 grid lg:grid-cols-3 gap-4">
          <div className="card-surface p-5 lg:col-span-2 space-y-4">
            <h3 className="font-semibold">Tóm tắt ứng viên</h3>
            <p className="text-sm text-foreground/80">
              {candidate?.yearsOfExperience != null
                ? `${candidate.yearsOfExperience} năm kinh nghiệm.`
                : "Chưa có thông tin kinh nghiệm."}{" "}
              {(candidate?.skills ?? []).length > 0
                ? `Thế mạnh về ${candidate!.skills!.join(", ")}.`
                : ""}
            </p>
            {candidate?.bio && (
              <p className="text-sm text-muted-foreground">{candidate.bio}</p>
            )}
            <div>
              <h4 className="font-semibold text-sm mb-2">Kỹ năng</h4>
              <div className="flex flex-wrap gap-1.5">
                {(candidate?.skills ?? []).map((s) => (
                  <span
                    key={s}
                    className="text-xs bg-success-soft text-success border border-success/20 px-2 py-0.5 rounded-md"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="card-surface p-5 space-y-3">
            <h3 className="font-semibold">Liên hệ</h3>
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                {candidate?.email ?? "—"}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                {candidate?.phone ?? "—"}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                {candidate?.address ?? "—"}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cv" className="mt-5 card-surface p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">CV ứng viên</h3>
            {previewCvUrl ? (
              <a
                href={previewCvUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <FileText className="size-4 mr-1" /> Xem CV
                </Button>
              </a>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <FileText className="size-4 mr-1" /> Không có CV
              </Button>
            )}
          </div>
          {previewCvUrl ? (
            <div className="w-full h-[700px] border border-border rounded-lg overflow-hidden bg-muted">
              <iframe
                src={previewCvUrl}
                className="w-full h-full"
                title="CV Preview"
              />
            </div>
          ) : (
            <div className="aspect-[3/4] max-w-md mx-auto rounded-lg bg-muted flex items-center justify-center text-muted-foreground border-2 border-dashed border-border text-sm">
              Ứng viên chưa đính kèm CV
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-5 grid lg:grid-cols-3 gap-4">
          {aiStatus === "PENDING" || aiStatus == null ? (
            <div className="card-surface p-8 lg:col-span-3 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm">AI đang phân tích CV và JD, vui lòng chờ...</p>
            </div>
          ) : aiStatus === "FAILED" ? (
            <div className="card-surface p-8 lg:col-span-3 flex flex-col items-center gap-3 text-destructive">
              <AlertCircle className="size-8" />
              <p className="text-sm">Phân tích AI thất bại. Vui lòng liên hệ quản trị viên.</p>
            </div>
          ) : (
            <>
              <div className="card-surface p-5 lg:col-span-2 space-y-4">
                <h3 className="font-semibold">Chi tiết Matching Score</h3>
                <div className="flex items-center gap-6">
                  <AIScoreRing score={score} size={120} thickness={10} />
                  <div className="flex-1 space-y-2 text-sm text-muted-foreground">
                    <div>
                      Kỹ năng phù hợp:{" "}
                      {(application.matchedSkills ?? []).join(", ") || "—"}
                    </div>
                    <div>
                      Kỹ năng thiếu:{" "}
                      {(application.missingSkills ?? []).join(", ") || "—"}
                    </div>
                  </div>
                </div>
                {application.coverLetter && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Thư giới thiệu</h4>
                    <p className="text-sm text-muted-foreground">
                      {application.coverLetter}
                    </p>
                  </div>
                )}
                <AIInsightBox title="AI Recommendation">
                  <div className="mb-2">
                    <StatusBadge
                      status={score >= 70 ? "Đạt chuẩn" : "Cần xem xét"}
                    />
                  </div>
                  {(application.missingSkills ?? []).length > 0
                    ? `Ứng viên cần bổ sung: ${application.missingSkills!.join(", ")}.`
                    : "Ứng viên đáp ứng đầy đủ yêu cầu kỹ năng."}
                </AIInsightBox>
              </div>
              <SkillGapCard
                matched={application.matchedSkills ?? []}
                missing={application.missingSkills ?? []}
                suggested={[]}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="test" className="mt-5 card-surface p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-foreground">Kết quả bài kiểm tra</h3>
          </div>
          {attemptsLoading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Đang tải kết quả...</span>
            </div>
          ) : attempts.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Ứng viên chưa tham gia bài kiểm tra nào.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                    <th className="py-3 px-4 text-left">Bài kiểm tra</th>
                    <th className="py-3 px-4 text-center">Điểm</th>
                    <th className="py-3 px-4 text-center">Kết quả</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-center">Thời gian nộp</th>
                    <th className="py-3 px-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => {
                    const assessment = assessments.find((as) => as.id === a.assessmentId);
                    return (
                      <tr key={a.attemptId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {assessment?.title ?? a.assessmentId ?? "Bài test không rõ"}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold">
                          {a.result === 'OVERTIME'
                            ? '—'
                            : a.correctAnswers != null && a.totalQuestions != null && a.totalQuestions > 0
                              ? `${a.correctAnswers}/${a.totalQuestions}`
                              : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${a.result === 'PASS' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                            a.result === 'FAIL' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                              a.result === 'OVERTIME' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' :
                                'bg-muted text-muted-foreground border-border'
                            }`}>
                            {a.result === 'PASS' ? 'Đạt' : a.result === 'FAIL' ? 'Chưa đạt' : a.result === 'OVERTIME' ? 'Hết giờ' : 'Chờ chấm'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-muted-foreground text-xs">{a.status}</td>
                        <td className="py-3.5 px-4 text-center text-muted-foreground text-xs">
                          {a.submittedAt ? new Date(a.submittedAt).toLocaleString('vi-VN') : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteAttemptMutation.mutate({ attemptId: a.attemptId! })}
                            disabled={deleteAttemptMutation.isPending}
                            className="h-7 text-xs font-semibold text-red-600 border-red-500/30 hover:bg-red-500/10 cursor-pointer"
                          >
                            Làm lại
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="interview"
          className="mt-5 card-surface p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Câu hỏi phỏng vấn AI</h3>
            <Button onClick={generateQuestions} className="gap-2">
              <Sparkles className="size-4" /> Sinh câu hỏi
            </Button>
          </div>
          {questions ? (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border p-4 flex gap-3"
                >
                  <div className="size-7 rounded-full bg-ai text-ai-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 text-sm">{q}</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard?.writeText(q);
                      toast("Đã copy");
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Bấm "Sinh câu hỏi" để AI tạo 5 câu hỏi phỏng vấn.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}

import React, { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@smart-cv/ui";
import {
  Plus,
  Trash2,
  Edit,
  Clock,
  HelpCircle,
  AlertTriangle,
  UserPlus,
  BookOpen,
  X,
  ListChecks,
  Eye,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  MoreHorizontal,
  Upload,
  Download,
} from "lucide-react";
import {
  useGetRecruiterAssessments,
  useCreateAssessment,
  useUpdateAssessment,
  useDeleteAssessment,
  useAssignToCandidate,
  getGetRecruiterAssessmentsQueryKey,
  ApplicationModels,
  useGetByRecruiter,
  useGetRecruiterApplications,
  RecruiterApi,
  usePublishAssessment,
  useGetAttemptsByAssessment,
  useGetCandidateByUserId,
  parseAssessmentFile,
  downloadAssessmentTemplate,
  useGenerateAssessmentQuestions,
} from "@smart-cv/api";
import { toast } from "sonner";

type Question = ApplicationModels.Question;
type QuestionType = ApplicationModels.QuestionType;
const QuestionType = {
  MCQ: "MCQ" as const,
  TEXT: "TEXT" as const,
};
type AssessmentResponse = ApplicationModels.AssessmentResponse;

export const Route = createFileRoute("/employer/assessments")({
  head: () => ({ meta: [{ title: "Quản lý Bài kiểm tra" }] }),
  component: AssessmentsManager,
});

function AssessmentsManager() {
  const queryClient = useQueryClient();

  // Queries
  const { data: apiResponse, isLoading, isError } = useGetRecruiterAssessments();
  const assessments: AssessmentResponse[] = apiResponse?.data ?? [];

  const { data: recruiterData } = RecruiterApi.useGetMe1();
  const recruiterId = recruiterData?.data?.id;

  const { data: jobsData } = useGetByRecruiter(recruiterId ?? "", {
    query: { enabled: !!recruiterId },
  });
  const jobs = useMemo(() => jobsData?.data ?? [], [jobsData?.data]);

  // Preview State
  const [previewingAssessment, setPreviewingAssessment] = useState<AssessmentResponse | null>(null);

  // Mutations
  const createMutation = useCreateAssessment({
    mutation: {
      onSuccess: () => {
        toast.success("Tạo bài kiểm tra thành công!");
        queryClient.invalidateQueries({ queryKey: getGetRecruiterAssessmentsQueryKey() });
        setIsFormOpen(false);
      },
      onError: (err: unknown) => {
        toast.error((err as { message?: string })?.message || "Tạo bài kiểm tra thất bại.");
      },
    },
  });

  const updateMutation = useUpdateAssessment({
    mutation: {
      onSuccess: () => {
        toast.success("Cập nhật bài kiểm tra thành công!");
        queryClient.invalidateQueries({ queryKey: getGetRecruiterAssessmentsQueryKey() });
        setIsFormOpen(false);
      },
      onError: (err: unknown) => {
        toast.error((err as { message?: string })?.message || "Cập nhật bài kiểm tra thất bại.");
      },
    },
  });

  const deleteMutation = useDeleteAssessment({
    mutation: {
      onSuccess: () => {
        toast.success("Xoá bài kiểm tra thành công!");
        queryClient.invalidateQueries({ queryKey: getGetRecruiterAssessmentsQueryKey() });
        setIsDeleteOpen(false);
      },
      onError: (err: unknown) => {
        toast.error((err as { message?: string })?.message || "Xoá bài kiểm tra thất bại.");
      },
    },
  });

  const assignMutation = useAssignToCandidate({
    mutation: {
      onSuccess: () => {
        toast.success("Gán bài kiểm tra cho ứng viên thành công!");
        queryClient.invalidateQueries({ queryKey: getGetRecruiterAssessmentsQueryKey() });
        setIsAssignOpen(false);
      },
      onError: (err: unknown) => {
        toast.error((err as { message?: string })?.message || "Gán bài kiểm tra thất bại.");
      },
    },
  });

  const publishMutation = usePublishAssessment({
    mutation: {
      onSuccess: () => {
        toast.success("Bài kiểm tra đã được công bố!");
        queryClient.invalidateQueries({ queryKey: getGetRecruiterAssessmentsQueryKey() });
      },
      onError: () => toast.error("Công bố bài kiểm tra thất bại."),
    },
  });

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isAttemptsOpen, setIsAttemptsOpen] = useState(false);
  const [assessmentForAttempts, setAssessmentForAttempts] = useState<AssessmentResponse | null>(null);

  // Active items
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [assessmentToDelete, setAssessmentToDelete] = useState<AssessmentResponse | null>(null);
  const [assessmentToAssign, setAssessmentToAssign] = useState<AssessmentResponse | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jobId, setJobId] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
  const [questions, setQuestions] = useState<Question[]>([]);

  // AI Generator States
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiJobName, setAiJobName] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState("Trung bình");
  const [aiLevel, setAiLevel] = useState("Junior");
  const [aiNumQuestions, setAiNumQuestions] = useState<number | "">(5);

  const generateMutation = useGenerateAssessmentQuestions();

  // Excel Import
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsImporting(true);
    try {
      const result = await parseAssessmentFile(file);
      if (result.questions.length === 0) {
        const reasons = result.skippedRows.map(r => `Dòng ${r.rowNumber}: ${r.reason}`).join(" | ");
        toast.error(`Không tìm thấy câu hỏi hợp lệ.${reasons ? " " + reasons : ""}`);
        return;
      }
      toast.success(`Đã import ${result.questions.length} câu hỏi`);
      if (result.skippedRows.length > 0) {
        const detail = result.skippedRows.map(r => `Dòng ${r.rowNumber}: ${r.reason}`).join(" | ");
        toast.warning(`Bỏ qua ${result.skippedRows.length} dòng không hợp lệ: ${detail}`);
      }
      setTitle("");
      setDescription("");
      setJobId("");
      setTimeLimitMinutes(30);
      setIsEditMode(false);
      setCurrentId(null);
      setQuestions(result.questions);
      setIsFormOpen(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "File không đọc được. Vui lòng dùng file .xlsx hoặc .csv hợp lệ.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleAiConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiJobName.trim()) {
      toast.error("Vui lòng nhập tên công việc");
      return;
    }
    const selectedJob = activeJobs.find((j) => j.id === jobId);
    const jobDescription = selectedJob?.description ?? undefined;
    const jobSkills = selectedJob?.skills?.join(", ") ?? undefined;
    const jobRequirements = selectedJob?.requirements?.join("\n") ?? undefined;
    generateMutation.mutate(
      {
        jobName: aiJobName,
        level: aiLevel,
        difficulty: aiDifficulty,
        numQuestions: Number(aiNumQuestions) || 5,
        jobDescription,
        jobSkills,
        jobRequirements,
      },
      {
        onSuccess: (response) => {
          const questions = response.data?.questions ?? [];
          if (questions.length === 0) {
            toast.error("AI không tạo được câu hỏi. Vui lòng thử lại.");
            return;
          }
          const mapped: Question[] = questions.slice(0, Number(aiNumQuestions) || 5).map((q) => ({
            id: crypto.randomUUID(),
            text: q.text,
            type: "MCQ" as const,
            options: q.options,
            correctOptionIndex: q.correctOptionIndex,
          }));
          setQuestions(mapped);
          setTitle(`Bài test ${aiJobName} - Trình độ ${aiLevel}`);
          setDescription(`Bài test tự động tạo bằng AI cho vị trí ${aiJobName} (${aiLevel}) với độ khó ${aiDifficulty}.`);
          setIsAiDialogOpen(false);
          setIsFormOpen(true);
          toast.success("Đã tạo câu hỏi bằng AI thành công!");
        },
        onError: (err: any) => {
          const errCode = err?.response?.data?.code;
          if (errCode === 8012 || errCode === 6008) {
            toast.error("Hết lượt sử dụng AI. Vui lòng nâng cấp gói dịch vụ.");
          } else {
            toast.error("Không thể tạo câu hỏi bằng AI. Vui lòng thử lại.");
          }
        },
      }
    );
  };

  const activeJobs = React.useMemo(() => {
    const list = jobs.filter((j) => j.visibilityStatus === "ACTIVE");
    if (jobId && !list.some((j) => j.id === jobId)) {
      const currentJob = jobs.find((j) => j.id === jobId);
      if (currentJob) {
        list.push(currentJob);
      }
    }
    return list;
  }, [jobs, jobId]);

  // Assign Field
  const [selectedCandidateId, setSelectedCandidateId] = useState("");

  const { data: applicationsData } = useGetRecruiterApplications(
    { size: 1000 },
    { query: { enabled: isAssignOpen || isAttemptsOpen } },
  );
  const filteredApplications = (applicationsData?.data?.items ?? []).filter(
    (item) => item.jobId === assessmentToAssign?.jobId,
  );

  const { data: attemptsData } = useGetAttemptsByAssessment(
    assessmentForAttempts?.id ?? "",
    { query: { enabled: isAttemptsOpen && !!assessmentForAttempts?.id } },
  );
  const attempts: ApplicationModels.AttemptSummaryResponse[] = attemptsData?.data ?? [];

  // Initialize form for Create/Edit
  const handleOpenCreate = () => {
    setIsEditMode(false);
    setCurrentId(null);
    setTitle("");
    setDescription("");
    setJobId("");
    setTimeLimitMinutes(30);
    setQuestions([]);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (a: AssessmentResponse) => {
    setIsEditMode(true);
    setCurrentId(a.id || null);
    setTitle(a.title || "");
    setDescription(a.description || "");
    setJobId(a.jobId || "");
    setTimeLimitMinutes(a.timeLimitMinutes || 30);
    setQuestions(a.questions ? [...a.questions] : []);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (a: AssessmentResponse) => {
    setAssessmentToDelete(a);
    setIsDeleteOpen(true);
  };

  const handleOpenAssign = (a: AssessmentResponse) => {
    setAssessmentToAssign(a);
    setSelectedCandidateId("");
    setIsAssignOpen(true);
  };

  // Question handlers
  const handleAddQuestion = () => {
    const newQ: Question = {
      id: `q_${Date.now()}`,
      text: "",
      type: QuestionType.MCQ,
      options: ["Lựa chọn 1", "Lựa chọn 2"],
      correctOptionIndex: 0,
    };
    setQuestions([...questions, newQ]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_: Question, i: number) => i !== index));
  };

  const handleQuestionChange = (index: number, fields: Partial<Question>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...fields };
    setQuestions(updated);
  };

  const handleAddOption = (qIndex: number) => {
    const q = questions[qIndex];
    if (!q.options || q.options.length >= 6) return;
    const updated = [...questions];
    updated[qIndex] = {
      ...q,
      options: [...(q.options || []), `Lựa chọn ${q.options.length + 1}`],
    };
    setQuestions(updated);
  };

  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    const q = questions[qIndex];
    if (!q.options || q.options.length <= 2) return;
    const updated = [...questions];
    const newOptions = q.options.filter((_: string, i: number) => i !== optIndex);
    let newCorrect = q.correctOptionIndex || 0;
    if (newCorrect >= newOptions.length) {
      newCorrect = newOptions.length - 1;
    }
    updated[qIndex] = {
      ...q,
      options: newOptions,
      correctOptionIndex: newCorrect,
    };
    setQuestions(updated);
  };

  const handleOptionTextChange = (qIndex: number, optIndex: number, text: string) => {
    const q = questions[qIndex];
    if (!q.options) return;
    const updated = [...questions];
    const newOptions = [...q.options];
    newOptions[optIndex] = text;
    updated[qIndex] = { ...q, options: newOptions };
    setQuestions(updated);
  };

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Vui lòng nhập tên bài test");
      return;
    }
    if (questions.length === 0) {
      toast.error("Vui lòng thêm ít nhất 1 câu hỏi");
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text?.trim()) {
        toast.error(`Nội dung câu hỏi thứ ${i + 1} không được để trống`);
        return;
      }
      if (q.type === QuestionType.MCQ) {
        if (!q.options || q.options.length < 2) {
          toast.error(`Câu hỏi thứ ${i + 1} phải có ít nhất 2 phương án`);
          return;
        }
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].trim()) {
            toast.error(`Phương án ${j + 1} của câu hỏi thứ ${i + 1} không được để trống`);
            return;
          }
        }
        if (
          q.correctOptionIndex === undefined ||
          q.correctOptionIndex < 0 ||
          q.correctOptionIndex >= q.options.length
        ) {
          toast.error(`Vui lòng chọn phương án đúng cho câu hỏi thứ ${i + 1}`);
          return;
        }
      }
    }

    const payload = {
      title,
      description,
      jobId,
      timeLimitMinutes,
      questions,
    };

    if (isEditMode && currentId) {
      updateMutation.mutate({ id: currentId, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  const handleDelete = () => {
    if (assessmentToDelete?.id) {
      deleteMutation.mutate({ id: assessmentToDelete.id });
    }
  };

  const handleAssign = () => {
    if (assessmentToAssign?.id && selectedCandidateId) {
      assignMutation.mutate({
        id: assessmentToAssign.id,
        data: { candidateId: selectedCandidateId },
      });
    }
  };

  const getJobTitle = (id?: string) => {
    if (!id) return "Tất cả vị trí";
    const job = jobs.find((j) => j.id === id);
    return job ? (job.title ?? "Tất cả vị trí") : "Tất cả vị trí";
  };

  if (previewingAssessment) {
    return (
      <TakeAssessmentPreview
        assessment={previewingAssessment}
        onClose={() => setPreviewingAssessment(null)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ListChecks className="size-8 text-primary" />
            Đánh giá &amp; Kiểm tra
          </h1>
          <p className="text-muted-foreground mt-1">
            Tạo và quản lý các bài kiểm tra trắc nghiệm, tự luận để đánh giá năng lực ứng viên.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button
            variant="outline"
            onClick={() => importInputRef.current?.click()}
            disabled={isImporting}
            className="gap-2 cursor-pointer"
          >
            <Upload className="size-4" />
            {isImporting ? "Đang đọc..." : "Import Excel"}
          </Button>
          <div className="relative group">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <HelpCircle className="size-4" />
            </button>
            <div className="absolute right-0 top-10 z-50 hidden group-hover:block w-72 rounded-lg border border-border bg-card p-3 shadow-lg text-xs">
              <p className="font-semibold text-foreground mb-2">Format mỗi dòng Excel/CSV:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• <strong className="text-foreground">Question</strong> — nội dung câu hỏi (bắt buộc)</li>
                <li>• <strong className="text-foreground">Option A, Option B</strong> — bắt buộc với MCQ</li>
                <li>• <strong className="text-foreground">Option C, Option D</strong> — tuỳ chọn</li>
                <li>• <strong className="text-foreground">Correct</strong> — A, B, C hoặc D</li>
                <li>• Chỉ hỗ trợ câu hỏi <strong className="text-foreground">trắc nghiệm (MCQ)</strong></li>
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={() => downloadAssessmentTemplate()}
            title="Tải file mẫu"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <Download className="size-4" />
          </button>
          <Button onClick={handleOpenCreate} className="gap-2 shadow-sm font-semibold cursor-pointer">
            <Plus className="size-4" /> Tạo bài kiểm tra
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Đang tải danh sách bài kiểm tra...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center card-surface border-red-200/50 bg-red-50/10">
          <AlertTriangle className="size-12 text-destructive mb-3" />
          <h3 className="font-semibold text-lg">Đã có lỗi xảy ra</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1">
            Không thể tải dữ liệu từ máy chủ. Vui lòng kiểm tra lại kết nối backend hoặc thử lại sau.
          </p>
        </div>
      ) : assessments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center card-surface border-dashed">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <BookOpen className="size-10 text-primary" />
          </div>
          <h3 className="font-bold text-xl text-foreground">Chưa có bài test nào</h3>
          <p className="text-muted-foreground max-w-md mt-2 text-sm">
            Tạo các bài trắc nghiệm nhanh hoặc tự luận để đính kèm vào tin tuyển dụng và tự động chấm điểm cho ứng viên của bạn.
          </p>
          <Button onClick={handleOpenCreate} className="mt-6 gap-2">
            <Plus className="size-4" /> Tạo bài đầu tiên
          </Button>
        </div>
      ) : (
        <div className="card-surface overflow-hidden shadow-sm border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-6">Tên bài kiểm tra</th>
                  <th className="text-left py-4 px-4">Thời gian</th>
                  <th className="text-center py-4 px-4">Số câu</th>
                  <th className="text-left py-4 px-4">Vị trí áp dụng</th>
                  <th className="text-center py-4 px-4">Trạng thái</th>
                  <th className="text-right py-4 px-6">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {assessments.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                        {a.title}
                      </div>
                      {a.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-sm">
                          {a.description}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-muted-foreground font-medium">
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-muted-foreground" />
                        {a.timeLimitMinutes} phút
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center font-semibold text-foreground">
                      {a.questions?.length ?? 0}
                    </td>
                    <td className="py-4 px-4 text-muted-foreground">
                      <span className="rounded bg-secondary/80 px-2.5 py-1 text-xs font-medium text-secondary-foreground border border-border">
                        {getJobTitle(a.jobId)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${a.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}
                      >
                        {a.status === "ACTIVE" ? "Hoạt động" : "Nháp"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {a.status === "DRAFT" ? (
                            <DropdownMenuItem
                              onClick={() => publishMutation.mutate({ id: a.id! })}
                              disabled={publishMutation.isPending}
                              className="text-emerald-600 focus:text-emerald-600 cursor-pointer"
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              <span>Công bố</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => publishMutation.mutate({ id: a.id! })}
                              disabled={publishMutation.isPending}
                              className="text-amber-600 focus:text-amber-600 cursor-pointer"
                            >
                              <X className="mr-2 h-4 w-4" />
                              <span>Tạm ẩn</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => { setAssessmentForAttempts(a); setIsAttemptsOpen(true); }}
                            className="cursor-pointer"
                          >
                            <ListChecks className="mr-2 h-4 w-4" />
                            <span>Kết quả</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setPreviewingAssessment(a)}
                            className="cursor-pointer"
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            <span>Xem thử</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenAssign(a)}
                            className="cursor-pointer"
                          >
                            <UserPlus className="mr-2 h-4 w-4" />
                            <span>Gán</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenEdit(a)}
                            className="cursor-pointer"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            <span>Chỉnh sửa</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenDelete(a)}
                            className="text-red-600 focus:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Xoá</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE & EDIT FORM DIALOG */}
      {isFormOpen && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto flex flex-col p-6 rounded-lg border border-border shadow-lg">
            <DialogHeader className="flex flex-row justify-between items-center pr-6">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" />
                  {isEditMode ? "Chỉnh sửa bài kiểm tra" : "Tạo bài kiểm tra mới"}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Nhập các thông tin cơ bản và lập danh sách câu hỏi trắc nghiệm hoặc tự luận bên dưới.
                </DialogDescription>
              </div>
              {!isEditMode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsFormOpen(false);
                    setIsAiDialogOpen(true);
                  }}
                  className="gap-1.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Tạo bằng AI
                </Button>
              )}
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6 my-2 flex-1">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Tên bài kiểm tra *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Kiểm tra tư duy Java Core"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Thời gian làm bài *</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      max={180}
                      value={timeLimitMinutes}
                      onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value) || 30)}
                      className="flex h-9 w-full rounded-md border border-input bg-background pl-3 pr-12 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">phút</span>
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Vị trí áp dụng</label>
                  <select
                    value={jobId}
                    onChange={(e) => setJobId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Tất cả vị trí / Không bắt buộc</option>
                    {activeJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} ({j.company})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Mô tả ngắn</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả mục đích bài kiểm tra hoặc yêu cầu bổ sung cho ứng viên..."
                    rows={3}
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              {/* Questions Management */}
              <div className="space-y-4 border-t border-border pt-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-md font-bold text-foreground flex items-center gap-1.5">
                    <HelpCircle className="size-4.5 text-primary" />
                    Danh sách câu hỏi ({questions.length})
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddQuestion}
                    className="h-8 gap-1.5 text-xs font-semibold"
                  >
                    <Plus className="size-3.5" /> Thêm câu hỏi
                  </Button>
                </div>

                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {questions.map((q, qIndex) => (
                    <div
                      key={q.id || qIndex}
                      className="p-4 rounded-lg border border-border bg-muted/20 space-y-4 relative group"
                    >
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIndex)}
                        className="absolute top-3 right-3 text-muted-foreground hover:text-red-500 transition-colors p-1"
                        title="Xoá câu hỏi"
                      >
                        <X className="size-4" />
                      </button>

                      {/* Question header */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 space-y-1">
                          <span className="text-xs font-bold text-primary uppercase">Câu {qIndex + 1}</span>
                          <input
                            type="text"
                            required
                            value={q.text || ""}
                            onChange={(e) => handleQuestionChange(qIndex, { text: e.target.value })}
                            placeholder="Nhập nội dung câu hỏi..."
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </div>
                        <div className="w-full sm:w-44 space-y-1">
                          <span className="text-xs font-bold text-muted-foreground">Loại câu hỏi</span>
                          <select
                            value={q.type || QuestionType.MCQ}
                            onChange={(e) =>
                              handleQuestionChange(qIndex, {
                                type: e.target.value as QuestionType,
                                // If switched to TEXT, reset options & correct answer, else default to MCQ style
                                options:
                                  e.target.value === QuestionType.MCQ
                                    ? ["Lựa chọn 1", "Lựa chọn 2"]
                                    : [],
                                correctOptionIndex: e.target.value === QuestionType.MCQ ? 0 : undefined,
                              })
                            }
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value={QuestionType.MCQ}>Trắc nghiệm (MCQ)</option>
                            <option value={QuestionType.TEXT}>Tự luận (TEXT)</option>
                          </select>
                        </div>
                      </div>

                      {/* MCQ Options */}
                      {q.type === QuestionType.MCQ && q.options && (
                        <div className="pl-4 border-l-2 border-primary/20 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-muted-foreground">
                              Các phương án trả lời (Tick vào nút tròn để chọn phương án đúng)
                            </span>
                            {q.options.length < 6 && (
                              <button
                                type="button"
                                onClick={() => handleAddOption(qIndex)}
                                className="text-xs text-primary hover:underline font-semibold"
                              >
                                + Thêm phương án
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-2.5">
                            {q.options.map((opt: string, optIndex: number) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct_${q.id || qIndex}`}
                                  checked={q.correctOptionIndex === optIndex}
                                  onChange={() => handleQuestionChange(qIndex, { correctOptionIndex: optIndex })}
                                  className="size-4 text-primary focus:ring-primary cursor-pointer"
                                />
                                <input
                                  type="text"
                                  required
                                  value={opt}
                                  onChange={(e) => handleOptionTextChange(qIndex, optIndex, e.target.value)}
                                  className="flex h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                {q.options!.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(qIndex, optIndex)}
                                    className="text-muted-foreground hover:text-red-500 p-1"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="gap-2 font-semibold"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  Lưu bài test
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ASSIGN TO CANDIDATE DIALOG */}
      {isAssignOpen && (
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogContent className="max-w-md p-6 rounded-lg border border-border shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <UserPlus className="size-5 text-primary" />
                Gán bài kiểm tra cho ứng viên
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Chọn một ứng viên từ danh sách ứng tuyển để mời tham gia làm bài đánh giá năng lực này.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Bài kiểm tra đã chọn</label>
                <div className="p-3 bg-muted/30 border border-border rounded-md font-medium text-foreground">
                  {assessmentToAssign?.title}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Chọn ứng viên</label>
                <select
                  value={selectedCandidateId}
                  onChange={(e) => setSelectedCandidateId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {filteredApplications.map((item) => (
                    <option key={item.candidateId} value={item.candidateId}>
                      {`${item.candidateId?.slice(0, 8)}… — ${item.jobTitle}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignOpen(false)}>
                Hủy
              </Button>
              <Button
                onClick={handleAssign}
                disabled={assignMutation.isPending}
                className="gap-2 font-semibold"
              >
                {assignMutation.isPending && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                Mời ứng viên
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ATTEMPT RESULTS DIALOG */}
      {isAttemptsOpen && (
        <Dialog open={isAttemptsOpen} onOpenChange={(open) => { setIsAttemptsOpen(open); if (!open) setAssessmentForAttempts(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-6 rounded-lg border border-border shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ListChecks className="size-5 text-primary" />
                Kết quả bài kiểm tra: {assessmentForAttempts?.title}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Danh sách ứng viên đã tham gia bài kiểm tra
              </DialogDescription>
            </DialogHeader>
            {attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Chưa có ứng viên nào làm bài kiểm tra này.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                      <th className="py-2 px-3 text-left">Ứng viên</th>
                      <th className="py-2 px-3 text-center">Điểm</th>
                      <th className="py-2 px-3 text-center">Kết quả</th>
                      <th className="py-2 px-3 text-center">Trạng thái</th>
                      <th className="py-2 px-3 text-right">Thời gian nộp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((a) => (
                      <tr key={a.attemptId} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-3">
                          <CandidateInfoCell
                            candidateId={a.candidateId}
                            applications={applicationsData?.data?.items ?? []}
                          />
                        </td>
                        <td className="py-3 px-3 text-center font-semibold">
                          {a.result === 'OVERTIME' ? '—' : a.score != null ? `${a.score.toFixed(0)}%` : '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${a.result === 'PASS' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                            a.result === 'FAIL' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                              a.result === 'OVERTIME' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' :
                                'bg-muted text-muted-foreground border-border'
                            }`}>
                            {a.result === 'PASS' ? 'Đạt' : a.result === 'FAIL' ? 'Chưa đạt' : a.result === 'OVERTIME' ? 'Hết giờ' : 'Chờ chấm'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-muted-foreground text-xs">{a.status}</td>
                        <td className="py-3 px-3 text-right text-muted-foreground text-xs">
                          {a.submittedAt ? new Date(a.submittedAt).toLocaleString('vi-VN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAttemptsOpen(false)}>Đóng</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {isDeleteOpen && (
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="max-w-md p-6 rounded-lg border border-border shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-destructive flex items-center gap-2">
                <AlertTriangle className="size-5 text-destructive" />
                Xác nhận xoá bài kiểm tra
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Hành động này không thể hoàn tác. Bài kiểm tra này sẽ bị xoá vĩnh viễn khỏi hệ thống.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4">
              <p className="text-sm text-foreground">
                Bạn có chắc chắn muốn xoá bài kiểm tra:{" "}
                <strong className="text-foreground">{assessmentToDelete?.title}</strong>?
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                Hủy
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="gap-2 font-semibold"
              >
                {deleteMutation.isPending && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                Xác nhận xoá
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

       {isAiDialogOpen && (
         <Dialog
           open={isAiDialogOpen}
           onOpenChange={(open) => {
             setIsAiDialogOpen(open);
             if (!open) setIsFormOpen(true);
           }}
         >
           <DialogContent className="max-w-[450px] p-6 rounded-lg border border-border shadow-lg">
             <DialogHeader>
               <DialogTitle className="text-lg font-bold flex items-center gap-2">
                 <Sparkles className="h-5 w-5 text-primary" />
                 Tạo bài kiểm tra tự động bằng AI
               </DialogTitle>
             </DialogHeader>

             <form onSubmit={handleAiConfirm} className="space-y-4 mt-2">
               <div className="space-y-1.5 w-full min-w-0 max-w-full">
                 <label className="text-sm font-semibold text-foreground">Liên kết với Job (Vị trí tuyển dụng)</label>
                 <div className="w-full min-w-0 max-w-full">
                   <select
                     value={jobId}
                     onChange={(e) => {
                       const selectedVal = e.target.value;
                       setJobId(selectedVal);
                       // Also auto-fill the jobName input if it matches an active job
                       const selectedJob = activeJobs.find(j => j.id === selectedVal);
                       if (selectedJob && !aiJobName) {
                         setAiJobName(selectedJob.title ?? '');
                       }
                     }}
                     className="h-9 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none truncate"
                   >
                     <option value="">Không liên kết / Chọn vị trí...</option>
                     {activeJobs.map((j) => (
                       <option key={j.id} value={j.id}>
                         {j.title} ({j.company})
                       </option>
                   ))}
                  </select>
                </div>
              </div>

               <div className="space-y-1.5">
                 <label className="text-sm font-semibold text-foreground">Tên công việc / Chủ đề *</label>
                 <input
                   type="text"
                   required
                   value={aiJobName}
                   onChange={(e) => setAiJobName(e.target.value)}
                   placeholder="Ví dụ: React Developer, Java core..."
                   className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                 />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                   <label className="text-sm font-semibold text-foreground">Trình độ</label>
                   <select
                     value={aiLevel}
                     onChange={(e) => setAiLevel(e.target.value)}
                     className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none"
                   >
                     <option value="Intern">Intern</option>
                     <option value="Fresher">Fresher</option>
                     <option value="Junior">Junior</option>
                     <option value="Senior">Senior</option>
                     <option value="Lead">Lead</option>
                   </select>
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-sm font-semibold text-foreground">Độ khó</label>
                   <select
                     value={aiDifficulty}
                     onChange={(e) => setAiDifficulty(e.target.value)}
                     className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none"
                   >
                     <option value="Dễ">Dễ</option>
                     <option value="Trung bình">Trung bình</option>
                     <option value="Khó">Khó</option>
                   </select>
                 </div>
               </div>

               <div className="space-y-1.5">
                 <label className="text-sm font-semibold text-foreground">Số câu hỏi</label>
                 <input
                   type="number"
                   required
                   min={1}
                   max={20}
                   value={aiNumQuestions}
                   onChange={(e) => {
                     const val = e.target.value;
                     if (val === "") {
                       setAiNumQuestions("");
                     } else {
                       const parsed = parseInt(val);
                       setAiNumQuestions(isNaN(parsed) ? "" : parsed);
                     }
                   }}
                   className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                 />
               </div>

               <div className="flex justify-end gap-2 pt-3 border-t border-border mt-4">
                 <Button
                   type="button"
                   variant="outline"
                   onClick={() => {
                     setIsAiDialogOpen(false);
                     setIsFormOpen(true);
                   }}
                   disabled={generateMutation.isPending}
                 >
                   Hủy
                 </Button>
                 <Button type="submit" disabled={generateMutation.isPending}>
                   {generateMutation.isPending ? "Đang tạo bằng AI..." : "Xác nhận tạo"}
                 </Button>
               </div>
             </form>
           </DialogContent>
         </Dialog>
       )}
    </div>
  );
}

interface TakeAssessmentPreviewProps {
  assessment: AssessmentResponse;
  onClose: () => void;
}

function TakeAssessmentPreview({ assessment, onClose }: TakeAssessmentPreviewProps) {
  const questions = assessment.questions ?? [];
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { selectedOptionIndex?: number; textAnswer?: string }>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState((assessment.timeLimitMinutes ?? 30) * 60);

  // Countdown timer
  React.useEffect(() => {
    if (isSubmitted) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsSubmitted(true);
          toast.warning("Hết giờ làm bài! Bài thi đã tự động nộp.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSubmitted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleSelectOption = (qIndex: number, optIndex: number) => {
    setAnswers({
      ...answers,
      [qIndex]: { ...answers[qIndex], selectedOptionIndex: optIndex },
    });
  };

  const handleTextChange = (qIndex: number, text: string) => {
    setAnswers({
      ...answers,
      [qIndex]: { ...answers[qIndex], textAnswer: text },
    });
  };

  // Score Calculation
  const mcqQuestions = questions.filter((q) => q.type === QuestionType.MCQ);
  const textQuestions = questions.filter((q) => q.type === QuestionType.TEXT);

  let correctCount = 0;
  questions.forEach((q, idx) => {
    if (q.type === QuestionType.MCQ && q.correctOptionIndex !== undefined) {
      if (answers[idx]?.selectedOptionIndex === q.correctOptionIndex) {
        correctCount += 1;
      }
    }
  });

  const mcqScorePercent = mcqQuestions.length > 0 ? Math.round((correctCount / mcqQuestions.length) * 100) : 100;

  const handleReset = () => {
    setAnswers({});
    setCurrentQIndex(0);
    setIsSubmitted(false);
    setTimeLeft((assessment.timeLimitMinutes ?? 30) * 60);
  };

  if (questions.length === 0) {
    return (
      <div className="card-surface max-w-xl mx-auto p-10 text-center space-y-4 my-8">
        <AlertTriangle className="size-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Bài kiểm tra không có câu hỏi</h2>
        <p className="text-sm text-muted-foreground">Vui lòng thêm câu hỏi trước khi xem thử.</p>
        <Button onClick={onClose}>Quay lại</Button>
      </div>
    );
  }

  const currentQuestion = questions[currentQIndex];
  const totalQuestions = questions.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onClose} className="p-2 h-auto" title="Quay lại">
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 px-2.5 py-1 rounded-md">
              Chế độ Xem thử (Recruiter Preview)
            </span>
            <h1 className="text-2xl font-bold text-foreground mt-1">{assessment.title}</h1>
          </div>
        </div>

        {!isSubmitted && (
          <div className="flex items-center gap-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-4 text-muted-foreground" />
              Tổng thời gian: {assessment.timeLimitMinutes} phút
            </div>
            <div className={`flex items-center gap-2 font-mono text-xl font-bold px-4 py-1.5 rounded-full border ${timeLeft < 60 ? "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse" : "bg-primary/10 text-primary border-primary/20"
              }`}>
              <Clock className="size-5" />
              {formatTime(timeLeft)}
            </div>
          </div>
        )}
      </div>

      {isSubmitted ? (
        <div className="grid lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {/* Summary Column */}
          <div className="card-surface p-6 space-y-6 flex flex-col items-center text-center">
            <div className="rounded-full bg-emerald-500/10 p-5 text-emerald-500">
              <CheckCircle2 className="size-12" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Hoàn thành bài kiểm tra!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Đây là kết quả làm bài mô phỏng của bạn.
              </p>
            </div>

            {mcqQuestions.length > 0 && (
              <div className="w-full bg-muted/45 rounded-xl p-5 border border-border space-y-2">
                <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                  Kết quả trắc nghiệm
                </div>
                <div className="text-4xl font-extrabold text-primary">
                  {correctCount} / {mcqQuestions.length}
                </div>
                <div className="text-sm font-semibold text-muted-foreground">
                  Đúng {mcqScorePercent}% số câu trắc nghiệm
                </div>
              </div>
            )}

            {textQuestions.length > 0 && (
              <div className="w-full bg-amber-500/5 rounded-xl p-4 border border-amber-500/20 text-left text-xs text-amber-700 dark:text-amber-300">
                <strong>Lưu ý:</strong> Bài thi có {textQuestions.length} câu tự luận cần nhà tuyển dụng chấm điểm thủ công sau khi ứng viên nộp.
              </div>
            )}

            <div className="flex gap-3 w-full">
              <Button onClick={handleReset} variant="outline" className="flex-1 gap-2">
                <RefreshCw className="size-4" /> Làm lại
              </Button>
              <Button onClick={onClose} className="flex-1">
                Đóng xem thử
              </Button>
            </div>
          </div>

          {/* Details Review Column */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-lg font-bold text-foreground">Chi tiết bài làm</h3>
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const ans = answers[idx];
                const isCorrect = q.type === QuestionType.MCQ && ans?.selectedOptionIndex === q.correctOptionIndex;

                return (
                  <div key={idx} className="card-surface p-5 space-y-4 border border-border">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-xs font-bold text-primary uppercase">Câu {idx + 1}</span>
                        <h4 className="text-base font-semibold text-foreground mt-1">{q.text}</h4>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${q.type === QuestionType.MCQ
                        ? isCorrect
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-red-500/10 text-red-600 border-red-500/20"
                        : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        }`}>
                        {q.type === QuestionType.MCQ
                          ? isCorrect ? "Chính xác" : "Chưa đúng"
                          : "Chờ chấm điểm"
                        }
                      </span>
                    </div>

                    {q.type === QuestionType.MCQ && q.options && (
                      <div className="space-y-2 pl-2 border-l-2 border-border">
                        {q.options.map((opt, oIdx) => {
                          const isSelected = ans?.selectedOptionIndex === oIdx;
                          const isRightAnswer = q.correctOptionIndex === oIdx;

                          let optStyle = "border-border";
                          if (isSelected) {
                            optStyle = isRightAnswer ? "border-emerald-500 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" : "border-red-500 bg-red-500/5 text-red-700 dark:text-red-300";
                          } else if (isRightAnswer) {
                            optStyle = "border-emerald-500 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
                          }

                          return (
                            <div key={oIdx} className={`flex items-center gap-3 rounded-lg border p-3 text-sm font-medium ${optStyle}`}>
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isRightAnswer ? "bg-emerald-500 text-white" : isSelected ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                                }`}>
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className="flex-1">{opt}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.type === QuestionType.TEXT && (
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-muted-foreground">Câu trả lời của ứng viên:</div>
                        <div className="bg-muted/40 p-3.5 rounded-lg border border-border text-sm text-foreground italic whitespace-pre-wrap">
                          {ans?.textAnswer || "(Không có câu trả lời)"}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-6 animate-in fade-in duration-300">
          {/* Left Navigation Panel */}
          <div className="card-surface p-5 space-y-4 lg:col-span-1 h-fit">
            <h3 className="font-bold text-sm text-foreground">Bản đồ câu hỏi</h3>
            <div className="grid grid-cols-4 gap-2">
              {questions.map((_, idx) => {
                const isAnswered = answers[idx] !== undefined && (
                  answers[idx].selectedOptionIndex !== undefined ||
                  (answers[idx].textAnswer !== undefined && answers[idx].textAnswer!.trim() !== "")
                );
                const isActive = currentQIndex === idx;

                let btnClass = "border-border text-foreground hover:bg-muted/60";
                if (isActive) {
                  btnClass = "bg-primary text-white border-primary shadow-sm shadow-primary/25";
                } else if (isAnswered) {
                  btnClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold";
                }

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentQIndex(idx)}
                    className={`h-10 rounded-lg border flex items-center justify-center text-sm transition-all font-medium ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="pt-2 border-t border-border space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-primary border border-primary"></span>
                <span>Đang chọn</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500/10 border border-emerald-500/20"></span>
                <span>Đã trả lời</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-transparent border border-border"></span>
                <span>Chưa trả lời</span>
              </div>
            </div>
          </div>

          {/* Main Question Panel */}
          <div className="lg:col-span-3 card-surface p-6 space-y-6 flex flex-col justify-between min-h-[400px]">
            <div className="space-y-5">
              <div className="flex justify-between items-center text-xs text-muted-foreground font-semibold">
                <span>Câu hỏi {currentQIndex + 1} trên {totalQuestions}</span>
                <span className="bg-secondary px-2.5 py-0.5 rounded-md border border-border">
                  {currentQuestion.type === QuestionType.MCQ ? "Trắc nghiệm" : "Tự luận"}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${((currentQIndex + 1) / totalQuestions) * 100}%` }}
                />
              </div>

              <h2 className="text-lg font-bold leading-relaxed text-foreground">
                {currentQuestion.text}
              </h2>

              {/* Question choices */}
              {currentQuestion.type === QuestionType.MCQ && currentQuestion.options && (
                <div className="grid gap-3">
                  {currentQuestion.options.map((opt, oIdx) => {
                    const isSelected = answers[currentQIndex]?.selectedOptionIndex === oIdx;
                    return (
                      <label
                        key={oIdx}
                        onClick={() => handleSelectOption(currentQIndex, oIdx)}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-all hover:bg-muted/40 ${isSelected
                          ? "border-primary bg-primary/5 text-primary shadow-sm shadow-primary/5"
                          : "border-border text-foreground"
                          }`}
                      >
                        <input
                          type="radio"
                          name={`question_${currentQIndex}`}
                          checked={isSelected}
                          onChange={() => { }}
                          className="size-4 text-primary focus:ring-primary accent-primary"
                        />
                        <span className="text-sm font-semibold mr-1">
                          {String.fromCharCode(65 + oIdx)}.
                        </span>
                        <span className="text-sm font-medium">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Text answer */}
              {currentQuestion.type === QuestionType.TEXT && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">
                    Nhập câu trả lời tự luận của bạn:
                  </label>
                  <textarea
                    rows={6}
                    value={answers[currentQIndex]?.textAnswer || ""}
                    onChange={(e) => handleTextChange(currentQIndex, e.target.value)}
                    placeholder="Viết câu trả lời chi tiết tại đây..."
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between border-t border-border pt-5 mt-6">
              <Button
                variant="outline"
                disabled={currentQIndex === 0}
                onClick={() => setCurrentQIndex(currentQIndex - 1)}
              >
                Câu trước
              </Button>

              <div className="flex items-center gap-3">
                {currentQIndex < totalQuestions - 1 ? (
                  <Button
                    onClick={() => setCurrentQIndex(currentQIndex + 1)}
                  >
                    Câu tiếp theo
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setIsSubmitted(true);
                      toast.success("Nộp bài thi thành công!");
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6"
                  >
                    Nộp bài thi
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CandidateInfoCellProps {
  candidateId?: string;
  applications: ApplicationModels.ApplicationDetailResponse[];
}

function CandidateInfoCell({ candidateId, applications }: CandidateInfoCellProps) {
  const { data: candidateData, isLoading } = useGetCandidateByUserId(candidateId ?? "", {
    query: { enabled: !!candidateId, staleTime: 60_000 },
  });
  const candidate = candidateData?.data;
  const application = applications.find((app) => app.candidateId === candidateId);

  if (!candidateId) return <span className="text-muted-foreground">—</span>;
  if (isLoading) return <span className="text-muted-foreground animate-pulse">Đang tải...</span>;

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col">
        <span className="font-semibold text-foreground">{candidate?.fullName ?? "Không rõ"}</span>
        {/* <span className="text-[10px] text-muted-foreground font-mono">{candidateId.slice(0, 8)}…</span> */}
      </div>
      {application?.id && (
        <Link
          to="/employer/applicants/$id"
          params={{ id: application.id }}
          className="inline-flex items-center justify-center rounded cursor-pointer"
        >
          <Eye className="size-3 hover:text-red-500" />
        </Link>
      )}
    </div>
  );
}

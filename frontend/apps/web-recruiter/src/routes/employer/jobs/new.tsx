import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Stepper } from "@/components/ui-kit/Stepper";
import { Button, JOB_CATEGORY_OPTIONS } from "@smart-cv/ui";
import { AIInsightBox } from "@/components/ui-kit/AIInsightBox";
import { RecruiterApi, useCreateJob, useSubmitJob, useUpdateJob } from "@smart-cv/api";
import { toast } from "sonner";
import {
  Plus,
  Minus,
  X,
  Search,
  Calendar,
} from "lucide-react";
import {
  buildCreateJobPayload,
  getTomorrowDateInputValue,
  validateCreateJobStep,
  validateDraftJob,
  type CreateJobFormErrors,
} from "@/lib/jobForm";

export const Route = createFileRoute("/employer/jobs/new")({
  head: () => ({ meta: [{ title: "Đăng tin tuyển dụng" }] }),
  component: NewJob,
});

const STEPS = ["Thông tin cơ bản", "Mô tả công việc", "Quy tắc sàng lọc", "Xem trước & Gửi duyệt"];

const JOB_TYPE_OPTIONS = [
  { label: "Full-time", value: "FULL_TIME" },
  { label: "Part-time", value: "PART_TIME" },
  { label: "Remote", value: "REMOTE" },
  { label: "Hợp đồng", value: "CONTRACT" },
  { label: "Thực tập", value: "INTERNSHIP" },
] as const;

const EXPERIENCE_LEVEL_OPTIONS = [
  { label: "Thực tập sinh", value: "INTERN" },
  { label: "Junior", value: "JUNIOR" },
  { label: "Middle", value: "MIDDLE" },
  { label: "Senior", value: "SENIOR" },
  { label: "Lead", value: "LEAD" },
] as const;

type ApiError = {
  response?: {
    data?: {
      code?: number;
      message?: string;
    };
  };
};

function getJobTypeLabel(jobType: string) {
  return JOB_TYPE_OPTIONS.find((option) => option.value === jobType)?.label ?? "Chưa chọn";
}

function getExperienceLabel(experienceLevel: string) {
  return EXPERIENCE_LEVEL_OPTIONS.find((option) => option.value === experienceLevel)?.label ?? "Chưa chọn";
}

function formatSalary(salaryMin: string, salaryMax: string, isNegotiable: boolean) {
  if (isNegotiable) return "Thỏa thuận";
  if (!salaryMin && !salaryMax) return "Chưa cập nhật";

  const formatter = new Intl.NumberFormat("vi-VN");
  const min = salaryMin ? formatter.format(Number(salaryMin)) : "";
  const max = salaryMax ? formatter.format(Number(salaryMax)) : "";

  if (min && max) return `${min} - ${max} VND`;
  if (min) return `Từ ${min} VND`;
  return `Đến ${max} VND`;
}

function NewJob() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profileResponse, isLoading: isProfileLoading, isError: isProfileError } = RecruiterApi.useGetMe1();
  const companyName = profileResponse?.data?.companyName?.trim() ?? "";
  const quotaRemaining = profileResponse?.data?.quotaJobPost ?? 0;

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [jobType, setJobType] = useState("");
  const [category, setCategory] = useState("");
  const [deadline, setDeadline] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [description, setDescription] = useState("");
  const [requirementsText, setRequirementsText] = useState("");
  const [benefitsText, setBenefitsText] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [openings, setOpenings] = useState("");
  const [errors, setErrors] = useState<CreateJobFormErrors & { deadline?: string }>({});

  const [qualifiedThreshold, setQualifiedThreshold] = useState(70);
  const [rejectThreshold, setRejectThreshold] = useState(50);
  const [autoRejectEnabled, setAutoRejectEnabled] = useState(false);
  const [requiredTest, setRequiredTest] = useState("Không");
  const [draftJobId, setDraftJobId] = useState<string | null>(null);

  const createJobMutation = useCreateJob();
  const updateJobMutation = useUpdateJob();
  const submitJobMutation = useSubmitJob();
  const isSubmitting = createJobMutation.isPending || updateJobMutation.isPending || submitJobMutation.isPending;

  const tomorrow = getTomorrowDateInputValue();

  const formValues = {
    title,
    description,
    companyName,
    location,
    jobType,
    category,
    experienceLevel,
    salaryMin,
    salaryMax,
    isNegotiable,
    skills,
    requirementsText,
    benefitsText,
    deadline,
    openings,
    qualifiedThreshold,
    rejectThreshold,
    autoRejectEnabled,
    requiredTest,
  };

  const handleAddSkill = () => {
    const trimmedSkill = newSkill.trim();
    if (!trimmedSkill) return;
    if (skills.some((skill) => skill.toLowerCase() === trimmedSkill.toLowerCase())) {
      toast.error("Kỹ năng này đã tồn tại!");
      return;
    }
    setSkills([...skills, trimmedSkill]);
    setNewSkill("");
  };

  const clearError = (field: keyof typeof errors) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateCurrentStep = () => {
    const nextErrors = validateCreateJobStep(step, {
      title,
      location,
      jobType,
      description,
      experienceLevel,
    });

    setErrors((current) => ({ ...current, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const handleNextStep = () => {
    if (step <= 1 && !validateCurrentStep()) return;

    if (step === 2) {
      if (qualifiedThreshold <= 0 || rejectThreshold <= 0) {
        toast.error("Ngưỡng điểm sàng lọc phải lớn hơn 0%");
        return;
      }
      if (qualifiedThreshold > 100 || rejectThreshold > 100) {
        toast.error("Ngưỡng điểm tối đa là 100%");
        return;
      }
      if (rejectThreshold >= qualifiedThreshold) {
        toast.error("Ngưỡng tự động từ chối phải thấp hơn ngưỡng đạt yêu cầu");
        return;
      }
    }

    setStep((current) => current + 1);
  };

  const ensureProfileReady = () => {
    if (isProfileLoading) {
      toast.info("Đang tải thông tin doanh nghiệp. Vui lòng thử lại sau ít giây.");
      return false;
    }

    if (isProfileError) {
      toast.error("Không thể tải hồ sơ doanh nghiệp. Vui lòng thử lại.");
      return false;
    }

    if (!companyName) {
      toast.error("Vui lòng cập nhật tên công ty trong hồ sơ doanh nghiệp trước khi đăng tin.");
      navigate({ to: "/employer/profile" });
      return false;
    }

    return true;
  };

  const invalidateJobsList = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/jobs/my"], exact: false });
  };

  const handleQuotaExceededDraft = async () => {
    const jobId = await persistDraft();
    await invalidateJobsList();
    toast.error("Bạn đã hết quota đăng tin. Tin đã được lưu dưới dạng nháp.");
    navigate({ to: "/employer/billing" });
    return jobId;
  };

  const persistDraft = async () => {
    const payload = buildCreateJobPayload(formValues);

    if (draftJobId) {
      await updateJobMutation.mutateAsync({ id: draftJobId, data: payload as any });
      return draftJobId;
    }

    const created = await createJobMutation.mutateAsync({ data: payload as any });
    const nextDraftId = created.data?.id;
    if (!nextDraftId) throw new Error("No job id returned");
    setDraftJobId(nextDraftId);
    return nextDraftId;
  };

  const handleDraft = async () => {
    if (!ensureProfileReady()) return;
    const nextErrors = validateDraftJob({ title, location, jobType, description, experienceLevel });
    setErrors((current) => ({ ...current, ...nextErrors }));
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await persistDraft();
      await invalidateJobsList();
      toast.success("Đã lưu nháp");
      navigate({ to: "/employer/jobs" });
    } catch (err: unknown) {
      const error = err as ApiError;
      if (error.response?.data?.code === 2005) {
        setErrors((current) => ({ ...current, title: "Tên tin tuyển dụng này đã tồn tại" }));
        return;
      }
      toast.error(error.response?.data?.message || "Lưu nháp thất bại");
    }
  };

  const handleSubmit = async () => {
    if (!ensureProfileReady()) return;
    const draftErrors = validateDraftJob({ title, location, jobType, description, experienceLevel });
    setErrors((current) => ({ ...current, ...draftErrors }));
    if (Object.keys(draftErrors).length > 0) {
      setStep(0);
      return;
    }

    try {
      if (quotaRemaining === 0) {
        await handleQuotaExceededDraft();
        return;
      }

      const jobId = await persistDraft();
      await submitJobMutation.mutateAsync({ id: jobId });
      await invalidateJobsList();
      toast.success("Đã gửi tin để duyệt");
      navigate({ to: "/employer/jobs" });
    } catch (err: unknown) {
      const error = err as ApiError;
      const message = error.response?.data?.message ?? "";
      if (error.response?.data?.code === 2005) {
        setErrors((current) => ({ ...current, title: "Tên tin tuyển dụng này đã tồn tại" }));
        setStep(0);
        return;
      }
      if (error.response?.data?.code === 2003 &&
          (message.toLowerCase().includes("deadline") || message.toLowerCase().includes("hạn"))) {
        setErrors((current) => ({
          ...current,
          deadline: "Hạn nộp phải sau ngày hôm nay để gửi duyệt",
        }));
        setStep(0);
        toast.error(message || "Gửi duyệt thất bại. Tin đã được giữ ở trạng thái nháp.");
        return;
      }
      if (error.response?.data?.code === 6005) {
        toast.error("Bạn đã hết quota đăng tin. Tin đã được lưu dưới dạng nháp.");
        navigate({ to: "/employer/billing" });
        return;
      }
      toast.error(message || "Gửi duyệt thất bại. Tin đã được giữ ở trạng thái nháp.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Đăng tin tuyển dụng mới</h1>
      <div className="card-surface p-5">
        <Stepper steps={STEPS} current={step} />
      </div>

      {step === 0 && (
        <div className="card-surface p-6 space-y-4">
          <h2 className="font-semibold">Thông tin cơ bản</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <TextField
              label="Vị trí"
              value={title}
              onChange={(value) => {
                setTitle(value);
                clearError("title");
              }}
              error={errors.title}
            />
            <TextField
              label="Địa điểm"
              value={location}
              onChange={(value) => {
                setLocation(value);
                clearError("location");
              }}
              error={errors.location}
            />
            <SelectField
              label="Loại hình"
              value={jobType}
              onChange={(value) => {
                setJobType(value);
                clearError("jobType");
              }}
              options={JOB_TYPE_OPTIONS}
              placeholder="Chọn loại hình công việc"
              error={errors.jobType}
            />
            <SelectField
              label="Ngành nghề"
              value={category}
              onChange={setCategory}
              options={JOB_CATEGORY_OPTIONS}
              placeholder="Chọn ngành nghề"
            />
            <DateField
              label="Hạn nộp hồ sơ"
              value={deadline}
              min={tomorrow}
              onChange={(value) => {
                setDeadline(value);
                clearError("deadline");
              }}
              error={errors.deadline}
            />
            <TextField
              label="Số lượng tuyển dụng"
              type="number"
              min={1}
              value={openings}
              onChange={setOpenings}
            />
            <div className="md:col-span-2 flex items-center gap-2 py-2">
              <input
                type="checkbox"
                id="negotiableSalary"
                checked={isNegotiable}
                onChange={(e) => setIsNegotiable(e.target.checked)}
                className="size-4 rounded border-input accent-primary cursor-pointer"
              />
              <label htmlFor="negotiableSalary" className="text-sm font-semibold cursor-pointer">
                Mức lương thỏa thuận (Negotiable)
              </label>
            </div>
            {!isNegotiable && (
              <>
                <TextField
                  label="Lương tối thiểu (VND)"
                  type="number"
                  value={salaryMin}
                  onChange={setSalaryMin}
                />
                <TextField
                  label="Lương tối đa (VND)"
                  type="number"
                  value={salaryMax}
                  onChange={setSalaryMax}
                />
              </>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="card-surface p-6 space-y-4">
            <h2 className="font-semibold">Mô tả công việc</h2>
            <TextAreaField
              label="Mô tả"
              value={description}
              onChange={(value) => {
                setDescription(value);
                clearError("description");
              }}
              error={errors.description}
            />
            <TextAreaField
              label="Yêu cầu"
              value={requirementsText}
              onChange={setRequirementsText}
              placeholder="Mỗi yêu cầu trên một dòng"
            />
            <TextAreaField
              label="Quyền lợi"
              value={benefitsText}
              onChange={setBenefitsText}
              placeholder="Mỗi quyền lợi trên một dòng"
            />
            <div className="grid md:grid-cols-2 gap-4">
              <SelectField
                label="Kinh nghiệm"
                value={experienceLevel}
                onChange={(value) => {
                  setExperienceLevel(value);
                  clearError("experienceLevel");
                }}
                options={EXPERIENCE_LEVEL_OPTIONS}
                placeholder="Chọn mức kinh nghiệm"
                error={errors.experienceLevel}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kỹ năng yêu cầu</label>

              <div className="flex flex-wrap gap-2 mt-2">
                {skills.map((skill, index) => (
                  <span
                    key={skill + index}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 animate-fade-in"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => setSkills(skills.filter((_, i) => i !== index))}
                      className="hover:text-foreground focus:outline-none ml-1 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2 mt-3 max-w-md">
                <input
                  type="text"
                  placeholder="Nhập tên kỹ năng mới (ví dụ: Kubernetes)"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  className="flex-1 h-10 rounded-md border border-input px-3 text-sm bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddSkill}
                  className="size-10 p-0 flex items-center justify-center border-dashed cursor-pointer"
                >
                  <Plus className="size-5" />
                </Button>
              </div>
            </div>
          </div>
          <AIInsightBox title="Gợi ý AI">
            <ul className="list-disc list-inside space-y-1">
              <li>Thêm ít nhất 5 kỹ năng để tăng độ chính xác sàng lọc.</li>
              <li>Việc có mức lương cụ thể nhận nhiều ứng tuyển hơn 40%.</li>
            </ul>
          </AIInsightBox>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="card-surface p-6 space-y-4">
            <h2 className="font-semibold">Quy tắc sàng lọc AI</h2>
            <div className="flex flex-wrap items-end gap-6">
              <ThresholdField
                label="Ngưỡng đạt (%)"
                value={qualifiedThreshold}
                setValue={setQualifiedThreshold}
              />
              <ThresholdField
                label="Ngưỡng từ chối (%)"
                value={rejectThreshold}
                setValue={setRejectThreshold}
              />
              <div className="flex items-center gap-2 pb-2.5">
                <input
                  type="checkbox"
                  id="autoRejectByAI"
                  checked={autoRejectEnabled}
                  onChange={(e) => setAutoRejectEnabled(e.target.checked)}
                  className="size-4 rounded border-input accent-primary cursor-pointer"
                />
                <label htmlFor="autoRejectByAI" className="text-sm font-semibold cursor-pointer select-none">
                  Tự động từ chối bằng AI
                </label>
              </div>
            </div>

            <div>
              <SearchableSelect
                label="Bài kiểm tra bắt buộc"
                value={requiredTest}
                onChange={setRequiredTest}
                opts={["Không", "Backend Technical Test", "General IQ", "Frontend React Test", "Python Core Assessment"]}
              />
            </div>

            <div className="rounded-xl bg-secondary p-4 text-sm space-y-1">
              <div className="font-semibold">Quy tắc áp dụng</div>
              <div>• Điểm ≥ {qualifiedThreshold}% → <span className="text-success font-medium">Qualified</span></div>
              <div>• Điểm {rejectThreshold}–{qualifiedThreshold - 1}% → <span className="text-warning font-medium">Under Review</span></div>
              <div>• Điểm &lt; {rejectThreshold}% → <span className="text-danger font-medium">Not Qualified {autoRejectEnabled && "(Auto-Rejected by AI)"}</span></div>
              <div className="mt-2 text-xs text-muted-foreground border-t border-border/50 pt-1.5">
                {autoRejectEnabled
                  ? "✓ AI sẽ tự động gửi email từ chối tới các ứng viên dưới ngưỡng mà không cần sự can thiệp từ Recruiter."
                  : "ℹ AI chỉ phân loại và đánh dấu. Recruiter vẫn có thể xem lại và thay đổi quyết định thủ công."}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="card-surface p-6">
            <h2 className="font-semibold">Xem trước tin tuyển dụng</h2>
            <div className="mt-4 rounded-xl border border-border p-5">
              <h3 className="text-xl font-bold">{title || "Chưa nhập vị trí"}</h3>
              <div className="text-sm text-muted-foreground">
                {(companyName || "Chưa cập nhật tên công ty")} • {location || "Chưa nhập địa điểm"} • {getJobTypeLabel(jobType)}
              </div>
              <div className="mt-3 text-sm text-success font-semibold">
                {formatSalary(salaryMin, salaryMax, isNegotiable)}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skills.length > 0 ? skills.map((skill) => (
                  <span key={skill} className="text-xs bg-secondary px-2 py-0.5 rounded-md">{skill}</span>
                )) : <span className="text-xs text-muted-foreground">Chưa có kỹ năng yêu cầu</span>}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div><strong>Kinh nghiệm:</strong> {getExperienceLabel(experienceLevel)}</div>
                <div><strong>Hạn nộp:</strong> {deadline || "Không giới hạn"}</div>
                <div><strong>Số lượng tuyển:</strong> {openings ? `${openings} người` : "Không giới hạn"}</div>
              </div>
            </div>
          </div>
          <div className="card-surface p-6 text-sm">
            <h3 className="font-semibold mb-2">Cấu hình AI Screening</h3>
            <div className="text-muted-foreground">
              Qualified ≥ {qualifiedThreshold}% • Under Review {rejectThreshold}–{qualifiedThreshold - 1}% • Auto-reject &lt; {rejectThreshold}% ({autoRejectEnabled ? "AI tự động từ chối" : "AI đánh dấu, Recruiter duyệt"}){requiredTest !== "Không" && ` • Yêu cầu ${requiredTest}`}
            </div>
          </div>
          <div className="card-surface p-6 text-sm flex justify-between">
            <div>
              {isProfileLoading ? "Đang tải quota..." : `Quota còn lại: ${quotaRemaining} tin`}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step > 0 ? setStep(step - 1) : navigate({ to: "/employer/jobs" })}>
          {step === 0 ? "Huỷ" : "Quay lại"}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDraft} disabled={isSubmitting}>
            {createJobMutation.isPending || updateJobMutation.isPending ? "Đang lưu..." : "Lưu nháp"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={handleNextStep}>Tiếp theo</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Đang xử lý..." : "Gửi duyệt"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  type = "text",
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: "text" | "number";
  min?: number;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full h-10 rounded-md border border-input px-3 text-sm bg-background"
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
  placeholder: string;
  error?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full h-10 rounded-md border border-input px-3 text-sm bg-background"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-input px-3 py-2 text-sm bg-background"
        placeholder={placeholder || `Nhập ${label.toLowerCase()}...`}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  min,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: string;
  error?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="relative mt-1.5 flex items-center">
        <input
          type="date"
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              // showPicker not supported in all browsers
            }
          }}
          onFocus={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              // showPicker not supported in all browsers
            }
          }}
          className="w-full h-10 rounded-md border border-input pl-3 pr-10 text-sm bg-background cursor-pointer"
        />
        <Calendar className="absolute right-3 size-4 text-muted-foreground pointer-events-none" />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

function ThresholdField({
  label,
  value,
  setValue,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
}) {
  return (
    <div className="w-36">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative mt-1.5 flex items-center">
        <button
          type="button"
          onClick={() => setValue(Math.max(1, value - 1))}
          className="absolute left-1 flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
        >
          <Minus className="size-4" />
        </button>
        <input
          type="number"
          min="1"
          max="100"
          value={value}
          onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
          className="w-full h-10 rounded-md border border-input px-8 text-center text-sm bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => setValue(Math.min(100, value + 1))}
          className="absolute right-1 flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function SearchableSelect({
  label,
  value,
  onChange,
  opts,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  opts: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = opts.filter((option) =>
    option.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative w-72">
      <label className="text-sm font-medium">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="mt-1.5 w-full h-10 rounded-md border border-input px-3 text-left text-sm bg-background flex items-center justify-between cursor-pointer"
      >
        <span>{value}</span>
        <span className="text-muted-foreground text-[10px]">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-md p-1.5 space-y-1 animate-fade-in card-surface">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 rounded pl-8 pr-2.5 text-xs bg-secondary border border-input focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              autoFocus
            />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5 mt-1">
            {filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground p-2">Không tìm thấy kết quả</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-secondary transition-colors cursor-pointer ${option === value ? "bg-primary/10 text-primary font-medium" : ""}`}
                >
                  {option}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

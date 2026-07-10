import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Stepper } from "@/components/ui-kit/Stepper";
import { Button, JOB_CATEGORY_OPTIONS } from "@smart-cv/ui";
import { AIInsightBox } from "@/components/ui-kit/AIInsightBox";
import {
  RecruiterApi,
  useUpdateJob,
  useSubmitJob,
  useGetMyJobById,
  getMyJobById,
} from "@smart-cv/api";
import { toast } from "sonner";
import { Plus, Minus, X, Search, Calendar } from "lucide-react";
import {
  buildCreateJobPayload,
  getTomorrowDateInputValue,
  validateCreateJobStep,
  type CreateJobFormErrors,
} from "@/lib/jobForm";
import type { JobUpdateRequest } from "@smart-cv/api";

export const Route = createFileRoute("/employer/jobs/$id")({
  head: () => ({ meta: [{ title: "Chỉnh sửa tin tuyển dụng" }] }),
  component: EditJob,
});

const STEPS = [
  "Thông tin cơ bản",
  "Mô tả công việc",
  "Quy tắc sàng lọc",
  "Xem trước & Lưu",
];

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
  response?: { data?: { code?: number; message?: string } };
};

type FormFields = {
  title: string;
  location: string;
  jobType: string;
  category: string;
  experienceLevel: string;
  deadline: string;
  salaryMin: string;
  salaryMax: string;
  isNegotiable: boolean;
  description: string;
  requirementsText: string;
  benefitsText: string;
  skills: string[];
  openings: string;
  qualifiedThreshold: number;
  rejectThreshold: number;
  autoRejectEnabled: boolean;
  requiredTest: string;
};


function getJobTypeLabel(jobType: string) {
  return (
    JOB_TYPE_OPTIONS.find((o) => o.value === jobType)?.label ?? "Chưa chọn"
  );
}

function getExperienceLabel(experienceLevel: string) {
  return (
    EXPERIENCE_LEVEL_OPTIONS.find((o) => o.value === experienceLevel)?.label ??
    "Chưa chọn"
  );
}

function formatSalary(
  salaryMin: string,
  salaryMax: string,
  isNegotiable: boolean
) {
  if (isNegotiable) return "Thỏa thuận";
  if (!salaryMin && !salaryMax) return "Chưa cập nhật";
  const formatter = new Intl.NumberFormat("vi-VN");
  const min = salaryMin ? formatter.format(Number(salaryMin)) : "";
  const max = salaryMax ? formatter.format(Number(salaryMax)) : "";
  if (min && max) return `${min} - ${max} VND`;
  if (min) return `Từ ${min} VND`;
  return `Đến ${max} VND`;
}

function EditJob() {
  const { id } = Route.useParams();

  const { data, isLoading, isError } = useGetMyJobById(id);
  const job = data?.data;

  const { data: profileResponse, isLoading: isProfileLoading } =
    RecruiterApi.useGetMe1();
  const companyName = profileResponse?.data?.companyName?.trim() ?? "";
  const quotaRemaining = profileResponse?.data?.quotaJobPost ?? 0;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="h-10 w-48 rounded-lg bg-muted animate-pulse mb-6" />
        <div className="h-96 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="max-w-4xl mx-auto card-surface p-6 text-sm text-danger">
        Không thể tải tin tuyển dụng. Vui lòng thử lại.
      </div>
    );
  }

  return (
    <EditJobForm
      key={job.id}
      id={id}
      job={job}
      companyName={companyName}
      quotaRemaining={quotaRemaining}
      isProfileLoading={isProfileLoading}
    />
  );
}

type JobData = NonNullable<Awaited<ReturnType<typeof getMyJobById>>["data"]>;

function initFormFromJob(job: NonNullable<JobData>): FormFields {
  return {
    title: job.title ?? "",
    location: job.location ?? "",
    jobType: job.jobType ?? "",
    category: (job as unknown as { category?: string }).category ?? "",
    experienceLevel: job.experienceLevel ?? "",
    deadline: job.deadline ?? "",
    salaryMin: job.salaryMin != null ? String(job.salaryMin) : "",
    salaryMax: job.salaryMax != null ? String(job.salaryMax) : "",
    isNegotiable: job.salaryMin == null && job.salaryMax == null,
    description: job.description ?? "",
    requirementsText: (job.requirements ?? []).join("\n"),
    benefitsText: (job.benefits ?? []).join("\n"),
    skills: job.skills ?? [],
    openings: job.openings != null ? String(job.openings) : "",
    qualifiedThreshold: job.qualifiedThreshold ?? 70,
    rejectThreshold: job.rejectThreshold ?? 50,
    autoRejectEnabled: job.autoRejectEnabled ?? false,
    requiredTest: job.requiredTest ?? "Không",
  };
}

function EditJobForm({
  id,
  job,
  companyName,
  quotaRemaining,
  isProfileLoading,
}: {
  id: string;
  job: NonNullable<JobData>;
  companyName: string;
  quotaRemaining: number;
  isProfileLoading: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormFields>(() => initFormFromJob(job));
  const [newSkill, setNewSkill] = useState("");
  const [errors, setErrors] = useState<
    CreateJobFormErrors & { deadline?: string }
  >({});

  const setField = <K extends keyof FormFields>(k: K, v: FormFields[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const updateJobMutation = useUpdateJob();
  const submitJobMutation = useSubmitJob();
  const isSubmitting = updateJobMutation.isPending || submitJobMutation.isPending;

  const tomorrow = getTomorrowDateInputValue();
  const isReadOnly = job.moderationStatus === "PENDING" ||
    job.visibilityStatus === "EXPIRED";

  const formValues = {
    title: form.title,
    description: form.description,
    companyName,
    location: form.location,
    jobType: form.jobType,
    category: form.category,
    experienceLevel: form.experienceLevel,
    salaryMin: form.salaryMin,
    salaryMax: form.salaryMax,
    isNegotiable: form.isNegotiable,
    skills: form.skills,
    requirementsText: form.requirementsText,
    benefitsText: form.benefitsText,
    deadline: form.deadline,
    openings: form.openings,
    qualifiedThreshold: form.qualifiedThreshold,
    rejectThreshold: form.rejectThreshold,
    autoRejectEnabled: form.autoRejectEnabled,
    requiredTest: form.requiredTest,
  };

  const clearError = (field: keyof typeof errors) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateCurrentStep = () => {
    const nextErrors = validateCreateJobStep(step, {
      title: form.title,
      location: form.location,
      jobType: form.jobType,
      description: form.description,
      experienceLevel: form.experienceLevel,
    });
    setErrors((current) => ({ ...current, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const handleNextStep = () => {
    if (step <= 1 && !validateCurrentStep()) return;
    if (step === 2) {
      if (form.qualifiedThreshold <= 0 || form.rejectThreshold <= 0) {
        toast.error("Ngưỡng điểm phải lớn hơn 0%");
        return;
      }
      if (form.qualifiedThreshold > 100 || form.rejectThreshold > 100) {
        toast.error("Ngưỡng điểm tối đa là 100%");
        return;
      }
      if (form.rejectThreshold >= form.qualifiedThreshold) {
        toast.error("Ngưỡng từ chối phải thấp hơn ngưỡng đạt yêu cầu");
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed) return;
    if (form.skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Kỹ năng này đã tồn tại!");
      return;
    }
    setField("skills", [...form.skills, trimmed]);
    setNewSkill("");
  };

  const invalidateJobs = () =>
    queryClient.invalidateQueries({
      queryKey: ["/api/jobs/my"],
      exact: false,
    });

  const handleSave = async () => {
    try {
      await updateJobMutation.mutateAsync({
        id,
        data: buildCreateJobPayload(formValues) as unknown as JobUpdateRequest,
      });
      await invalidateJobs();
      toast.success("Đã lưu thay đổi");
    } catch (err: unknown) {
      const e = err as ApiError;
      toast.error(e.response?.data?.message ?? "Lưu thất bại");
    }
  };

  const handleSubmitForReview = async () => {
    if (quotaRemaining === 0) {
      toast.error("Bạn đã hết quota đăng tin.");
      navigate({ to: "/employer/billing" });
      return;
    }
    try {
      await updateJobMutation.mutateAsync({
        id,
        data: buildCreateJobPayload(formValues) as unknown as JobUpdateRequest,
      });
      await submitJobMutation.mutateAsync({ id });
      await invalidateJobs();
      toast.success("Đã gửi tin để duyệt");
      navigate({ to: "/employer/jobs" });
    } catch (err: unknown) {
      const e = err as ApiError;
      const message = e.response?.data?.message ?? "";
      if (e.response?.data?.code === 6005) {
        toast.error("Bạn đã hết quota đăng tin.");
        navigate({ to: "/employer/billing" });
        return;
      }
      toast.error(message || "Gửi duyệt thất bại");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Chỉnh sửa tin tuyển dụng</h1>

      {isReadOnly && (
        <div className="card-surface p-4 text-sm text-warning border border-warning/30">
          Tin tuyển dụng này đang{" "}
          {job.moderationStatus === "PENDING" ? "chờ duyệt" : "hết hạn"} và không thể chỉnh
          sửa.
        </div>
      )}

      <div className="card-surface p-5">
        <Stepper steps={STEPS} current={step} />
      </div>

      {step === 0 && (
        <div className="card-surface p-6 space-y-4">
          <h2 className="font-semibold">Thông tin cơ bản</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <TextField
              label="Vị trí"
              value={form.title}
              onChange={(v) => {
                setField("title", v);
                clearError("title");
              }}
              error={errors.title}
              disabled={isReadOnly}
            />
            <TextField
              label="Địa điểm"
              value={form.location}
              onChange={(v) => {
                setField("location", v);
                clearError("location");
              }}
              error={errors.location}
              disabled={isReadOnly}
            />
            <SelectField
              label="Loại hình"
              value={form.jobType}
              onChange={(v) => {
                setField("jobType", v);
                clearError("jobType");
              }}
              options={JOB_TYPE_OPTIONS}
              placeholder="Chọn loại hình công việc"
              error={errors.jobType}
              disabled={isReadOnly}
            />
            <SelectField
              label="Ngành nghề"
              value={form.category}
              onChange={(v) => setField("category", v)}
              options={JOB_CATEGORY_OPTIONS}
              placeholder="Chọn ngành nghề"
              disabled={isReadOnly}
            />
            <DateField
              label="Hạn nộp hồ sơ"
              value={form.deadline}
              min={tomorrow}
              onChange={(v) => {
                setField("deadline", v);
                clearError("deadline");
              }}
              error={errors.deadline}
              disabled={isReadOnly}
            />
            <TextField
              label="Số lượng tuyển dụng"
              type="number"
              min={1}
              value={form.openings}
              onChange={(v) => setField("openings", v)}
              disabled={isReadOnly}
            />
            <div className="md:col-span-2 flex items-center gap-2 py-2">
              <input
                type="checkbox"
                id="negotiableSalaryEdit"
                checked={form.isNegotiable}
                onChange={(e) => setField("isNegotiable", e.target.checked)}
                className="size-4 rounded border-input accent-primary cursor-pointer"
                disabled={isReadOnly}
              />
              <label
                htmlFor="negotiableSalaryEdit"
                className="text-sm font-semibold cursor-pointer"
              >
                Mức lương thỏa thuận (Negotiable)
              </label>
            </div>
            {!form.isNegotiable && (
              <>
                <TextField
                  label="Lương tối thiểu (VND)"
                  type="number"
                  value={form.salaryMin}
                  onChange={(v) => setField("salaryMin", v)}
                  disabled={isReadOnly}
                />
                <TextField
                  label="Lương tối đa (VND)"
                  type="number"
                  value={form.salaryMax}
                  onChange={(v) => setField("salaryMax", v)}
                  disabled={isReadOnly}
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
              value={form.description}
              onChange={(v) => {
                setField("description", v);
                clearError("description");
              }}
              error={errors.description}
              disabled={isReadOnly}
            />
            <TextAreaField
              label="Yêu cầu"
              value={form.requirementsText}
              onChange={(v) => setField("requirementsText", v)}
              placeholder="Mỗi yêu cầu trên một dòng"
              disabled={isReadOnly}
            />
            <TextAreaField
              label="Quyền lợi"
              value={form.benefitsText}
              onChange={(v) => setField("benefitsText", v)}
              placeholder="Mỗi quyền lợi trên một dòng"
              disabled={isReadOnly}
            />
            <div className="grid md:grid-cols-2 gap-4">
              <SelectField
                label="Kinh nghiệm"
                value={form.experienceLevel}
                onChange={(v) => {
                  setField("experienceLevel", v);
                  clearError("experienceLevel");
                }}
                options={EXPERIENCE_LEVEL_OPTIONS}
                placeholder="Chọn mức kinh nghiệm"
                error={errors.experienceLevel}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kỹ năng yêu cầu</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {form.skills.map((skill, index) => (
                  <span
                    key={skill + index}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
                  >
                    {skill}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() =>
                          setField(
                            "skills",
                            form.skills.filter((_, i) => i !== index)
                          )
                        }
                        className="hover:text-foreground focus:outline-none ml-1 cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {!isReadOnly && (
                <div className="flex gap-2 mt-3 max-w-md">
                  <input
                    type="text"
                    placeholder="Nhập tên kỹ năng mới"
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
              )}
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
                value={form.qualifiedThreshold}
                setValue={(v) => setField("qualifiedThreshold", v)}
                disabled={isReadOnly}
              />
              <ThresholdField
                label="Ngưỡng từ chối (%)"
                value={form.rejectThreshold}
                setValue={(v) => setField("rejectThreshold", v)}
                disabled={isReadOnly}
              />
              <div className="flex items-center gap-2 pb-2.5">
                <input
                  type="checkbox"
                  id="autoRejectEdit"
                  checked={form.autoRejectEnabled}
                  onChange={(e) =>
                    setField("autoRejectEnabled", e.target.checked)
                  }
                  className="size-4 rounded border-input accent-primary cursor-pointer"
                  disabled={isReadOnly}
                />
                <label
                  htmlFor="autoRejectEdit"
                  className="text-sm font-semibold cursor-pointer select-none"
                >
                  Tự động từ chối bằng AI
                </label>
              </div>
            </div>
            <div>
              <SearchableSelect
                label="Bài kiểm tra bắt buộc"
                value={form.requiredTest}
                onChange={(v) => setField("requiredTest", v)}
                opts={[
                  "Không",
                  "Backend Technical Test",
                  "General IQ",
                  "Frontend React Test",
                  "Python Core Assessment",
                ]}
                disabled={isReadOnly}
              />
            </div>
            <div className="rounded-xl bg-secondary p-4 text-sm space-y-1">
              <div className="font-semibold">Quy tắc áp dụng</div>
              <div>
                • Điểm ≥ {form.qualifiedThreshold}% →{" "}
                <span className="text-success font-medium">Qualified</span>
              </div>
              <div>
                • Điểm {form.rejectThreshold}–{form.qualifiedThreshold - 1}% →{" "}
                <span className="text-warning font-medium">Under Review</span>
              </div>
              <div>
                • Điểm &lt; {form.rejectThreshold}% →{" "}
                <span className="text-danger font-medium">
                  Not Qualified{" "}
                  {form.autoRejectEnabled && "(Auto-Rejected by AI)"}
                </span>
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
              <h3 className="text-xl font-bold">
                {form.title || "Chưa nhập vị trí"}
              </h3>
              <div className="text-sm text-muted-foreground">
                {companyName || "Chưa cập nhật tên công ty"} •{" "}
                {form.location || "Chưa nhập địa điểm"} •{" "}
                {getJobTypeLabel(form.jobType)}
              </div>
              <div className="mt-3 text-sm text-success font-semibold">
                {formatSalary(form.salaryMin, form.salaryMax, form.isNegotiable)}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {form.skills.length > 0 ? (
                  form.skills.map((s) => (
                    <span
                      key={s}
                      className="text-xs bg-secondary px-2 py-0.5 rounded-md"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Chưa có kỹ năng yêu cầu
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div>
                  <strong>Kinh nghiệm:</strong>{" "}
                  {getExperienceLabel(form.experienceLevel)}
                </div>
                <div>
                  <strong>Hạn nộp:</strong>{" "}
                  {form.deadline || "Không giới hạn"}
                </div>
                <div>
                  <strong>Số lượng tuyển:</strong>{" "}
                  {form.openings ? `${form.openings} người` : "Không giới hạn"}
                </div>
              </div>
            </div>
          </div>
          <div className="card-surface p-6 text-sm">
            <h3 className="font-semibold mb-2">Cấu hình AI Screening</h3>
            <div className="text-muted-foreground">
              Qualified ≥ {form.qualifiedThreshold}% • Under Review{" "}
              {form.rejectThreshold}–{form.qualifiedThreshold - 1}% •
              Auto-reject &lt; {form.rejectThreshold}% (
              {form.autoRejectEnabled
                ? "AI tự động từ chối"
                : "AI đánh dấu, Recruiter duyệt"}
              )
              {form.requiredTest !== "Không" &&
                ` • Yêu cầu ${form.requiredTest}`}
            </div>
          </div>
          <div className="card-surface p-6 text-sm">
            {isProfileLoading
              ? "Đang tải quota..."
              : `Quota còn lại: ${quotaRemaining} tin`}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() =>
            step > 0 ? setStep(step - 1) : navigate({ to: "/employer/jobs" })
          }
        >
          {step === 0 ? "Quay lại" : "Trước"}
        </Button>
        <div className="flex gap-2">
          {!isReadOnly && (
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {updateJobMutation.isPending && !submitJobMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={handleNextStep}>Tiếp theo</Button>
          ) : !isReadOnly && job.moderationStatus === "DRAFT" ? (
            <Button onClick={handleSubmitForReview} disabled={isSubmitting}>
              {submitJobMutation.isPending ? "Đang xử lý..." : "Gửi duyệt"}
            </Button>
          ) : null}
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
  disabled,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: "text" | "number";
  disabled?: boolean;
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
        disabled={disabled}
        className="mt-1.5 w-full h-10 rounded-md border border-input px-3 text-sm bg-background disabled:opacity-50 disabled:cursor-not-allowed"
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
  placeholder: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1.5 w-full h-10 rounded-md border border-input px-3 text-sm bg-background disabled:opacity-50 disabled:cursor-not-allowed"
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1.5 w-full rounded-md border border-input px-3 py-2 text-sm bg-background disabled:opacity-50 disabled:cursor-not-allowed"
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: string;
  error?: string;
  disabled?: boolean;
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
          disabled={disabled}
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
          className="w-full h-10 rounded-md border border-input pl-3 pr-10 text-sm bg-background cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
  disabled,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="w-36">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative mt-1.5 flex items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setValue(Math.max(1, value - 1))}
          className="absolute left-1 flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
        >
          <Minus className="size-4" />
        </button>
        <input
          type="number"
          min="1"
          max="100"
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
          className="w-full h-10 rounded-md border border-input px-8 text-center text-sm bg-background focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setValue(Math.min(100, value + 1))}
          className="absolute right-1 flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  opts: string[];
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = opts.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-72">
      <label className="text-sm font-medium">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="mt-1.5 w-full h-10 rounded-md border border-input px-3 text-left text-sm bg-background flex items-center justify-between cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>{value}</span>
        <span className="text-muted-foreground text-[10px]">▼</span>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md p-1.5 space-y-1 card-surface">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 rounded pl-8 pr-2.5 text-xs bg-secondary border border-input focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5 mt-1">
            {filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground p-2">
                Không tìm thấy kết quả
              </div>
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
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-secondary transition-colors cursor-pointer ${
                    option === value
                      ? "bg-primary/10 text-primary font-medium"
                      : ""
                  }`}
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

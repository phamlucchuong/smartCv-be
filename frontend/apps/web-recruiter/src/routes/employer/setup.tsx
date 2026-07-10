import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button, buttonVariants, cn } from "@smart-cv/ui";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { RecruiterApi } from "@smart-cv/api";
import { Sparkles, Upload, FileText, Clock, ExternalLink } from "lucide-react";
import { isAuthError } from "../../lib/recruiterAuth";
import { useAuthStore } from "../../store/useAuthStore";

export const Route = createFileRoute("/employer/setup")({
  head: () => ({ meta: [{ title: "Company Profile Setup — SmartCV" }] }),
  component: SetupPage,
});

const REQUIRED_FIELDS = [
  "companyName",
  "taxCode",
  "companyAddress",
  "companyCity",
  "companySize",
  "companyType",
  "industry",
] as const;

const FIELD_LABELS: Record<string, string> = {
  companyName: "Tên công ty",
  taxCode: "Mã số thuế",
  companyAddress: "Địa chỉ",
  companyCity: "Tỉnh / Thành phố",
  companySize: "Quy mô",
  companyType: "Loại hình",
  industry: "Ngành nghề",
};

function SetupPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signOut = useAuthStore((state) => state.signOut);

  const { data, isLoading, isError, error } = RecruiterApi.useGetMe1();
  const recruiter = data?.data;
  const status = recruiter?.status;

  const updateMutation = RecruiterApi.useUpdate();
  const submitMutation = RecruiterApi.useSubmitForApproval();
  const uploadLicenseMutation = RecruiterApi.useUploadBusinessLicense();

  const [form, setForm] = useState({
    companyName: "",
    taxCode: "",
    companyAddress: "",
    companyCity: "",
    companySize: "",
    companyType: "",
    industry: "",
    companyDescription: "",
    companyWebsite: "",
    linkedinUrl: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });
  // File held in state until submit — not uploaded to S3 until the form is submitted
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const formInitialized = useRef(false);
  useEffect(() => {
    if (!recruiter || formInitialized.current) return;
    formInitialized.current = true;
    setForm({
      companyName: recruiter.companyName ?? "",
      taxCode: recruiter.taxCode ?? "",
      companyAddress: recruiter.companyAddress ?? "",
      companyCity: recruiter.companyCity ?? "",
      companySize: recruiter.companySize ?? "",
      companyType: recruiter.companyType ?? "",
      industry: recruiter.industry ?? "",
      companyDescription: recruiter.companyDescription ?? "",
      companyWebsite: recruiter.companyWebsite ?? "",
      linkedinUrl: recruiter.linkedinUrl ?? "",
      contactName: recruiter.contactName ?? "",
      contactEmail: recruiter.contactEmail ?? "",
      contactPhone: recruiter.contactPhone ?? "",
    });
  }, [recruiter]);

  // APPROVED users go directly to dashboard
  useEffect(() => {
    if (status === "APPROVED") {
      navigate({ to: "/employer", replace: true });
    }
  }, [status, navigate]);

  useEffect(() => {
    if (!isLoading && isError && isAuthError(error)) {
      toast.error("Không tìm thấy hồ sơ nhà tuyển dụng. Vui lòng đăng nhập lại.");
      signOut();
      navigate({ to: "/login", replace: true });
    }
  }, [error, isError, isLoading, navigate, signOut]);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  // Just store in state — upload happens only on submit
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recruiter?.id) return;

    for (const key of REQUIRED_FIELDS) {
      if (!form[key].trim()) {
        toast.error(`Vui lòng điền "${FIELD_LABELS[key]}" trước khi nộp hồ sơ.`);
        return;
      }
    }
    const hasLicense = !!recruiter.businessLicenseUrl || !!pendingFile;
    if (!hasLicense) {
      toast.error("Vui lòng tải lên giấy phép kinh doanh.");
      return;
    }

    // 1. Upload license to S3 (only if a new file was selected)
    if (pendingFile) {
      try {
        await uploadLicenseMutation.mutateAsync({ data: { file: pendingFile } });
        setPendingFile(null);
      } catch {
        toast.error("Tải lên giấy phép kinh doanh thất bại. Vui lòng thử lại.");
        return;
      }
    }

    // 2. Save profile data
    try {
      await updateMutation.mutateAsync({ id: recruiter.id, data: form });
    } catch {
      toast.error("Lưu thông tin thất bại. Vui lòng thử lại.");
      return;
    }

    // 3. Submit for approval
    try {
      await submitMutation.mutateAsync();
      toast.success("Hồ sơ đã được gửi để phê duyệt!");
      navigate({ to: "/employer/pending", replace: true });
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: number } } })
        ?.response?.data?.code;
      toast.error(
        code === 5004
          ? "Vui lòng điền đầy đủ các trường bắt buộc trước khi nộp hồ sơ."
          : "Không thể nộp hồ sơ. Vui lòng thử lại."
      );
    }
  };

  const isBusy =
    uploadLicenseMutation.isPending ||
    updateMutation.isPending ||
    submitMutation.isPending;

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left panel */}
      <div className="flex flex-col px-6 lg:px-16 py-10">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <span className="font-bold text-lg">SmartCV</span>
        </Link>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : !recruiter ? null : status === "PENDING" ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md w-full text-center space-y-4">
              <Clock className="size-12 mx-auto text-primary" />
              <p className="text-lg font-semibold">Hồ sơ đang chờ phê duyệt</p>
              <p className="text-sm text-muted-foreground">
                Quản trị viên sẽ xem xét trong 1–2 ngày làm việc.
              </p>
              <Link
                to="/employer/pending"
                className={cn(buttonVariants(), "w-full justify-center")}
              >
                Xem trạng thái
              </Link>
            </div>
          </div>
        ) : (
          /* DRAFT / REJECTED */
          <div className="flex-1 flex items-start pt-10 lg:items-center">
            <div className="w-full max-w-lg mx-auto">
              <h1 className="text-3xl font-bold">Hoàn thiện hồ sơ công ty</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Điền đầy đủ thông tin để được phê duyệt đăng tuyển dụng.
              </p>

              {status === "REJECTED" && recruiter?.rejectionNote && (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm font-medium text-destructive">
                    Hồ sơ bị từ chối:
                  </p>
                  <p className="text-sm mt-1 text-foreground">
                    {recruiter.rejectionNote}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                <section className="space-y-4">
                  <h2 className="text-base font-semibold border-b pb-2">
                    Thông tin công ty
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Tên công ty *" {...field("companyName")} />
                    <Field label="Mã số thuế *" {...field("taxCode")} />
                    <Field label="Địa chỉ *" {...field("companyAddress")} />
                    <Field label="Tỉnh / Thành phố *" {...field("companyCity")} />
                    <SelectField
                      label="Quy mô *"
                      {...field("companySize")}
                      options={["1-10", "11-50", "51-200", "201-500", "500+"]}
                    />
                    <SelectField
                      label="Loại hình *"
                      {...field("companyType")}
                      options={[
                        "STARTUP",
                        "TNHH",
                        "CO_PHAN",
                        "AGENCY",
                        "OUTSOURCING",
                        "PRODUCT",
                      ]}
                    />
                    <Field label="Ngành nghề *" {...field("industry")} />
                    <Field label="Website" {...field("companyWebsite")} />
                  </div>
                  <TextareaField
                    label="Mô tả công ty"
                    {...field("companyDescription")}
                  />
                </section>

                <section className="space-y-4">
                  <h2 className="text-base font-semibold border-b pb-2">
                    Giấy phép kinh doanh *
                  </h2>
                  <div
                    className="rounded-lg border-2 border-dashed border-border p-6 text-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {pendingFile ? (
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <FileText className="size-5" />
                        <span className="text-sm font-medium">
                          {pendingFile.name}
                        </span>
                      </div>
                    ) : recruiter?.businessLicenseUrl ? (
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <FileText className="size-5" />
                        <span className="text-sm font-medium">Đã tải lên</span>
                        <a
                          href={recruiter.businessLicenseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-1 text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5"
                        >
                          Xem <ExternalLink className="size-3" />
                        </a>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="size-8 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Tải lên PDF hoặc ảnh (tối đa 10 MB)
                        </p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,image/jpeg,image/png"
                      onChange={handleFileChange}
                    />
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-base font-semibold border-b pb-2">
                    Liên hệ HR
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Người phụ trách" {...field("contactName")} />
                    <Field
                      label="Email liên hệ"
                      {...field("contactEmail")}
                      type="email"
                    />
                    <Field label="Số điện thoại" {...field("contactPhone")} />
                    <Field label="LinkedIn" {...field("linkedinUrl")} />
                  </div>
                </section>

                <div className="pt-4 border-t">
                  <Button type="submit" className="w-full" disabled={isBusy}>
                    {uploadLicenseMutation.isPending
                      ? "Đang tải lên giấy phép..."
                      : updateMutation.isPending
                        ? "Đang lưu thông tin..."
                        : submitMutation.isPending
                          ? "Đang gửi hồ sơ..."
                          : "Nộp hồ sơ để phê duyệt"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — branding */}
      <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-primary via-brand-blue to-ai p-12 text-primary-foreground">
        <div className="max-w-md space-y-3">
          <h2 className="text-3xl font-bold leading-tight">
            Bắt đầu tuyển dụng cùng SmartCV
          </h2>
          <p className="opacity-90">
            Kết nối với hàng ngàn ứng viên tiềm năng. Hồ sơ của bạn sẽ được
            xem xét trong 1–2 ngày làm việc.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  disabled?: boolean;
}) {
  const id = label.replace(/[\s*]+/g, "-").toLowerCase();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="mt-1.5 w-full h-10 rounded-md border border-input px-3 text-sm bg-background disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
}) {
  const id = label.replace(/[\s*]+/g, "-").toLowerCase();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        rows={3}
        className="mt-1.5 w-full rounded-md border border-input px-3 py-2 text-sm bg-background resize-none disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  disabled?: boolean;
}) {
  const id = label.replace(/[\s*]+/g, "-").toLowerCase();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="mt-1.5 w-full h-10 rounded-md border border-input px-3 text-sm bg-background disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <option value="">Chọn...</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

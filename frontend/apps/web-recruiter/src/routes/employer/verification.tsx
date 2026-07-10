import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants, cn } from "@smart-cv/ui";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { ShieldCheck, CheckCircle2, ExternalLink, AlertTriangle } from "lucide-react";
import { useTranslation } from "@smart-cv/i18n";
import { RecruiterApi } from "@smart-cv/api";

export const Route = createFileRoute("/employer/verification")({
  head: () => ({ meta: [{ title: "Company Verification" }] }),
  component: VerificationPage,
});

function VerificationPage() {
  const { t } = useTranslation();
  const { data, isLoading } = RecruiterApi.useGetMe1();
  const recruiter = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isApproved = recruiter?.status === 'APPROVED';
  const isRejected = recruiter?.status === 'REJECTED';

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("recruiter_verification_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("recruiter_verification_subtitle")}</p>
        </div>
        {recruiter?.status && <StatusBadge status={recruiter.status} />}
      </div>

      {isApproved && (
        <div className="card-surface p-5 flex items-center gap-4 bg-success-soft border-success/20">
          <div className="size-12 rounded-full bg-success text-white flex items-center justify-center">
            <ShieldCheck className="size-6" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-success">{t("recruiter_verified_title")}</div>
            <div className="text-sm text-foreground/80">{t("recruiter_verified_desc")}</div>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="card-surface p-5 flex items-start gap-4 bg-destructive/5 border-destructive/20">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <AlertTriangle className="size-6" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-destructive">Hồ sơ bị từ chối</div>
            {recruiter?.rejectionNote && (
              <div className="mt-1 text-sm text-foreground/80">{recruiter.rejectionNote}</div>
            )}
            <Link to="/employer/setup" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}>
              Chỉnh sửa và nộp lại
            </Link>
          </div>
        </div>
      )}

      <div className="card-surface p-6 space-y-4">
        <h2 className="font-semibold">{t("recruiter_company_info")}</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <ReadField label={t("recruiter_company_name")} value={recruiter?.companyName} />
          <ReadField label={t("recruiter_tax_id")} value={recruiter?.taxCode} />
          <ReadField label={t("recruiter_business_email")} value={recruiter?.contactEmail} />
          <ReadField label={t("recruiter_website")} value={recruiter?.companyWebsite} />
          <ReadField label={t("recruiter_company_size")} value={recruiter?.companySize} />
          <ReadField label={t("recruiter_industry")} value={recruiter?.industry} />
          <ReadField label={t("recruiter_contact_name")} value={recruiter?.contactName} />
          <ReadField label={t("recruiter_phone")} value={recruiter?.contactPhone} />
        </div>
      </div>

      {recruiter?.businessLicenseUrl && (
        <div className="card-surface p-6">
          <h2 className="font-semibold mb-4">{t("recruiter_business_license")}</h2>
          <div className="rounded-xl border border-success/20 bg-success-soft p-4 flex items-center gap-3">
            <CheckCircle2 className="size-6 text-success" />
            <div className="flex-1">
              <div className="font-medium">Giấy phép kinh doanh</div>
              <div className="text-xs text-muted-foreground">{t("recruiter_approved_date")}</div>
            </div>
            <a
              href={recruiter.businessLicenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary underline"
            >
              Xem <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      )}

      {!isApproved && (
        <div className="flex justify-end">
          <Link to="/employer/setup" className={buttonVariants({ variant: "outline" })}>
            Chỉnh sửa hồ sơ
          </Link>
        </div>
      )}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1.5 w-full h-10 rounded-md border border-input px-3 text-sm bg-muted/30 flex items-center text-foreground">
        {value ?? <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

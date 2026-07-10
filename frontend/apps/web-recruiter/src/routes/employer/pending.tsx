import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { buttonVariants, cn } from "@smart-cv/ui";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { RecruiterApi } from "@smart-cv/api";
import { useEffect } from "react";
import { isAuthError } from "../../lib/recruiterAuth";
import { useAuthStore } from "../../store/useAuthStore";

export const Route = createFileRoute("/employer/pending")({
  head: () => ({ meta: [{ title: "Account Under Review — SmartCV" }] }),
  component: PendingPage,
});

function PendingPage() {
  const navigate = useNavigate();
  const signOut = useAuthStore((state) => state.signOut);
  const { data, isLoading, isError, error } = RecruiterApi.useGetMe1();
  const recruiter = data?.data;
  const status = recruiter?.status;

  useEffect(() => {
    if (status === 'APPROVED') {
      navigate({ to: '/employer', replace: true });
    }
  }, [status, navigate]);

  useEffect(() => {
    if (!isLoading && isError && isAuthError(error)) {
      signOut();
      navigate({ to: '/login', replace: true });
    }
  }, [error, isError, isLoading, navigate, signOut]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!recruiter) {
    return null;
  }

  if (status === 'APPROVED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="size-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Hồ sơ đã được phê duyệt!</h1>
          <p className="text-sm text-muted-foreground">
            Bạn đang được chuyển vào dashboard tuyển dụng.
          </p>
          <Link to="/employer" className={cn(buttonVariants(), "w-full justify-center")}>
            Vào dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'REJECTED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-10 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hồ sơ bị từ chối</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Admin đã xem xét hồ sơ của bạn và từ chối phê duyệt.
            </p>
          </div>
          {recruiter?.rejectionNote && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-left">
              <p className="text-sm font-medium text-destructive mb-1">Lý do từ chối:</p>
              <p className="text-sm text-foreground">{recruiter.rejectionNote}</p>
            </div>
          )}
          <Link to="/employer/setup" className={cn(buttonVariants(), "w-full justify-center")}>
            Chỉnh sửa và nộp lại
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/10">
          <Clock className="size-10 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hồ sơ đang được xem xét</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Chúng tôi sẽ xem xét hồ sơ công ty của bạn trong vòng 1–2 ngày làm việc.
            Bạn sẽ nhận được email thông báo khi có kết quả.
          </p>
        </div>
        {recruiter?.companyName && (
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">Công ty</p>
            <p className="font-semibold">{recruiter.companyName}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Nếu bạn có câu hỏi, vui lòng liên hệ{" "}
          <a href="mailto:support@smartcv.vn" className="underline">
            support@smartcv.vn
          </a>
        </p>
      </div>
    </div>
  );
}

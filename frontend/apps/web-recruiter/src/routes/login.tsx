import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@smart-cv/ui";
import { Sparkles, Mail, Lock, Brain, Target, Zap, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@smart-cv/i18n";
import { useState, useRef, useEffect } from "react";
import { getRecruiterLoginUser, useAuthenticateWithGoogle, useLoginCandidate, RecruiterApi, useVerifyCandidateRegistration, useResendRegistrationOtp } from "@smart-cv/api";
import {
  buildRecruiterProfilePayload,
  ensureRecruiterRole,
  extractAuthTokens,
  getRecruiterAccessState,
} from "../lib/recruiterAuth";
import { useAuthStore } from "../store/useAuthStore";
import { formatOtpCountdown, OTP_RESEND_SECONDS } from "../constants/otp";

type ApiError = {
  response?: {
    status?: number;
    data?: {
      code?: number;
      message?: string;
    };
  };
};

type GoogleAccounts = {
  id: {
    initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void
    renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
  }
}

function loadGoogleIdentityScript() {
  return new Promise<void>((resolve, reject) => {
    const googleWindow = window as Window & { google?: { accounts?: GoogleAccounts } }
    if (googleWindow.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity script'));
    document.head.appendChild(script);
  });
}

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Đăng nhập — SmartCV" }] }),
  component: Login,
});

function maskContact(contact: string): string {
  if (contact.includes("@")) {
    const [local, domain] = contact.split("@");
    return `${local.charAt(0)}***@${domain}`;
  }
  return `${contact.slice(0, 3)}***${contact.slice(-2)}`;
}

function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const signIn = useAuthStore((state) => state.signIn);
  const signOut = useAuthStore((state) => state.signOut);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  // OTP Verification States
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));
  const [otpCountdown, setOtpCountdown] = useState(OTP_RESEND_SECONDS);
  const [otpError, setOtpError] = useState("");
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const loginMutation = useLoginCandidate();
  const googleLogin = useAuthenticateWithGoogle();
  const verifyMutation = useVerifyCandidateRegistration();
  const resendMutation = useResendRegistrationOtp();

  // Timer Effect when OTP active
  useEffect(() => {
    if (!otpOpen) return;
    const timer = setInterval(() => {
      setOtpCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [otpOpen]);

  function openOtpPanel() {
    setOtpDigits(Array(6).fill(""));
    setOtpError("");
    setOtpCountdown(OTP_RESEND_SECONDS);
    setOtpOpen(true);
  }

  async function ensureRecruiterProfile() {
    try {
      const recruiter = await RecruiterApi.getMe1();
      if (recruiter?.data) {
        return recruiter.data;
      }
    } catch (err: unknown) {
      const error = err as ApiError;
      if (error.response?.status !== 404) {
        throw err;
      }
    }

    const currentUser = await getRecruiterLoginUser();
    const recruiter = await RecruiterApi.create(
      buildRecruiterProfilePayload({
        fullName: currentUser.data?.fullName,
        email: currentUser.data?.email ?? email.trim(),
        phone: currentUser.data?.phone,
      }),
    );

    return recruiter.data;
  }

  const completeRecruiterSignIn = async (accessToken: string, refreshToken: string) => {
    ensureRecruiterRole(accessToken);
    signIn(accessToken, refreshToken);

    try {
      const recruiter = await ensureRecruiterProfile();
      switch (getRecruiterAccessState(recruiter)) {
        case "approved":
          toast.success(t("recruiter_login_success"));
          navigate({ to: "/employer" });
          return;
        case "draft":
          toast.success("Đăng nhập thành công. Hãy hoàn thiện hồ sơ doanh nghiệp.");
          navigate({ to: "/employer/setup" });
          return;
        case "pending":
          toast.info("Hồ sơ doanh nghiệp đang chờ admin phê duyệt.");
          navigate({ to: "/employer/pending" });
          return;
        case "rejected":
          toast.info("Hồ sơ doanh nghiệp đã bị từ chối. Vui lòng xem chi tiết và cập nhật lại.");
          navigate({ to: "/employer/pending" });
          return;
        case "missing":
        default:
          signOut();
          toast.error("Không thể khởi tạo hồ sơ nhà tuyển dụng. Vui lòng thử lại.");
          return;
      }
    } catch (err: unknown) {
      signOut();
      const error = err as ApiError;
      toast.error(
        error.response?.status === 404
          ? "Tài khoản này chưa có hồ sơ nhà tuyển dụng. Vui lòng đăng ký lại và hoàn tất hồ sơ doanh nghiệp."
          : "Không thể kiểm tra trạng thái hồ sơ nhà tuyển dụng. Vui lòng thử lại.",
      );
    }
  };

  useEffect(() => {
    if (otpOpen || !googleClientId || !googleButtonRef.current) return;

    let cancelled = false;
    loadGoogleIdentityScript()
      .then(() => {
        const googleWindow = window as Window & { google?: { accounts?: GoogleAccounts } };
        const googleAccounts = googleWindow.google?.accounts;
        if (cancelled || !googleAccounts || !googleButtonRef.current) return;

        googleButtonRef.current.innerHTML = "";
        googleAccounts.id.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            if (!credential) {
              toast.error("Google sign-in failed. Please try again.");
              return;
            }
            try {
              const result = await googleLogin.mutateAsync({
                data: { idToken: credential, role: "RECRUITER" },
              });
              if (!result.data) {
                throw new Error(result.message || "Không nhận được phản hồi từ máy chủ.");
              }
              const { accessToken, refreshToken } = extractAuthTokens(result);
              await completeRecruiterSignIn(accessToken, refreshToken);
            } catch (err: unknown) {
              if (err instanceof Error && err.message === "This account does not have recruiter access.") {
                signOut();
                toast.error("Tài khoản này không có quyền nhà tuyển dụng.");
                return;
              }
              const error = err as ApiError;
              toast.error(error.response?.data?.message || "Google sign-in failed. Please try again.");
            }
          },
        });
        googleAccounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: 320,
        });
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t("google_signin_unavailable"));
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId, googleLogin, otpOpen, signOut, t]);

  const handleOtpChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = char;
    setOtpDigits(next);
    if (char && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(""));
      otpInputRefs.current[5]?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length < 6) return;
    setOtpError("");
    try {
      await verifyMutation.mutateAsync({
        data: {
          contact: email.trim(),
          verificationType: "EMAIL",
          code,
        },
      });
      await handleOtpSuccess();
    } catch (err: unknown) {
      const error = err as ApiError;
      setOtpError(error.response?.data?.message || "Mã OTP không chính xác. Vui lòng kiểm tra lại.");
    }
  };

  const handleOtpResend = async () => {
    if (otpCountdown > 0) return;
    setOtpError("");
    try {
      await resendMutation.mutateAsync({
        data: {
          contact: email.trim(),
          preferredVerification: "EMAIL",
        },
      });
      setOtpCountdown(OTP_RESEND_SECONDS);
      toast.success("Mã OTP mới đã được gửi!");
    } catch {
      setOtpError("Không thể gửi lại mã OTP. Vui lòng thử lại sau.");
    }
  };

  const handleOtpSuccess = async () => {
    setOtpOpen(false);
    toast.success("Xác minh tài khoản thành công!");
    try {
      await loginRecruiter();
    } catch {
      toast.error("Xác minh thành công nhưng đăng nhập thất bại. Vui lòng thử đăng nhập lại.");
    }
  };



  const loginRecruiter = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Vui lòng nhập đầy đủ Email và Mật khẩu");
      return;
    }
    
    try {
      const result = await loginMutation.mutateAsync({
        data: {
          email: email.trim(),
          password,
        },
      });

      if (result.code !== undefined && result.code !== 1000 && result.code !== 0 && result.code !== 200) {
        toast.error(result.message || "Đăng nhập thất bại. Vui lòng thử lại.");
        return;
      }

      if (!result.data) {
        toast.error(result.message || "Không nhận được phản hồi từ máy chủ.");
        return;
      }

      const { accessToken, refreshToken } = extractAuthTokens(result);
      await completeRecruiterSignIn(accessToken, refreshToken);

    } catch (err: unknown) {
      if (err instanceof Error && err.message === "This account does not have recruiter access.") {
        signOut();
        toast.error("Tài khoản này không có quyền nhà tuyển dụng.");
        return;
      }

      const error = err as ApiError;
      if (error.response?.data?.code === 3003) {
        toast.info("Tài khoản chưa được xác minh. Vui lòng xác minh OTP.");
        openOtpPanel();
      } else {
        toast.error(error.response?.data?.message || "Đăng nhập thất bại. Vui lòng thử lại.");
      }
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Form */}
      <div className="flex flex-col px-6 lg:px-16 py-10">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <span className="font-bold text-lg">SmartCV</span>
        </Link>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-md mx-auto">
            <h1 className="text-3xl font-bold">
              {otpOpen ? "Xác minh tài khoản" : t("recruiter_login_title")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {otpOpen
                ? `Nhập mã OTP 6 chữ số gửi đến ${maskContact(email)}`
                : t("recruiter_login_subtitle")}
            </p>

            <div className="mt-6 space-y-4">
              {otpOpen ? (
                <form onSubmit={handleOtpSubmit} className="space-y-6">
                  <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                    {otpDigits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpInputRefs.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="h-12 w-10 rounded-md border border-input bg-background text-center text-lg font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    ))}
                  </div>

                  {otpError && <p className="text-center text-sm text-destructive font-medium">{otpError}</p>}

                  <Button
                    type="submit"
                    className="h-11 w-full font-semibold"
                    disabled={otpDigits.join("").length < 6 || verifyMutation.isPending}
                  >
                    {verifyMutation.isPending ? "Đang xác minh..." : "Xác minh tài khoản"}
                  </Button>

                  <div className="text-center text-sm text-muted-foreground mt-4">
                    {otpCountdown > 0 ? (
                      <span>Gửi lại mã sau {formatOtpCountdown(otpCountdown)}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleOtpResend}
                        disabled={resendMutation.isPending}
                        className="text-primary hover:underline font-semibold disabled:opacity-50"
                      >
                        {resendMutation.isPending ? "Đang gửi..." : "Gửi lại OTP"}
                      </button>
                    )}
                  </div>

                  <div className="text-center text-sm mt-4">
                    <button
                      type="button"
                      onClick={() => setOtpOpen(false)}
                      className="text-muted-foreground hover:text-foreground text-xs underline"
                    >
                      Quay lại đăng nhập
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium">{t("email")}</label>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm" 
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">{t("password")}</label>
                      <a className="text-xs text-primary hover:underline cursor-pointer">{t("recruiter_forgot_password")}</a>
                    </div>
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-10 pl-9 pr-10 rounded-md border border-input bg-background text-sm" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
 
                  <Button 
                    className="w-full h-10 gap-2 font-semibold" 
                    onClick={loginRecruiter}
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    {t("recruiter_continue")}
                  </Button>
                  {googleClientId ? (
                    <>
                      <div className="relative text-center text-xs uppercase tracking-[0.2em] text-muted-foreground my-2">
                        <span className="bg-background px-3">or</span>
                      </div>
                      <div className="relative w-[320px] mx-auto h-10 overflow-hidden rounded-md border border-input shadow-sm transition-colors hover:bg-accent cursor-pointer">
                        {/* Custom Button UI */}
                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background text-sm font-medium text-foreground">
                          <svg className="h-4 w-4" viewBox="0 0 24 24">
                            <path
                              fill="#EA4335"
                              d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.58-5.14 3.58-8.74z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 24c3.24 0 5.97-1.08 7.96-2.92l-3.86-3c-1.08.72-2.45 1.16-4.1 1.16-3.15 0-5.81-2.13-6.76-5.01H1.37v3.1A11.99 11.99 0 0 0 12 24z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.24 14.23a7.22 7.22 0 0 1 0-4.46v-3.1H1.37a11.99 11.99 0 0 0 0 10.66l3.87-3.1z"
                            />
                            <path
                              fill="#4285F4"
                              d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.94 11.94 0 0 0 12 0 11.99 11.99 0 0 0 1.37 6.67l3.87 3.1c.95-2.88 3.61-5 6.76-5z"
                            />
                          </svg>
                          <span>Tiếp tục với Google</span>
                        </div>
                        {/* Invisible GSI button container */}
                        <div ref={googleButtonRef} className="absolute inset-0 opacity-0 cursor-pointer z-10 [&_iframe]:w-full [&_iframe]:h-full" />
                      </div>
                    </>
                  ) : null}

                  <p className="text-center text-sm text-muted-foreground">
                    {t("recruiter_no_account")}{" "}
                    <Link to="/signup/recruiter" className="text-primary font-medium hover:underline">
                      {t("register")}
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Visual */}
      <div className="hidden lg:flex relative items-center justify-center bg-gradient-to-br from-primary via-brand-blue to-ai p-12 text-primary-foreground">
        <div className="max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
            <Sparkles className="size-3.5" /> {t("recruiter_ai_platform")}
          </div>
          <h2 className="text-3xl font-bold leading-tight">{t("recruiter_login_visual_title")}</h2>
          <div className="space-y-3">
            {[
              { icon: Brain, title: t("recruiter_feature_ai_cv_title"), desc: t("recruiter_feature_ai_cv_desc") },
              { icon: Target, title: t("recruiter_feature_recommend_title"), desc: t("recruiter_feature_recommend_desc") },
              { icon: Zap, title: t("recruiter_feature_screening_title"), desc: t("recruiter_feature_screening_desc") },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-xl bg-white/10 backdrop-blur p-4 border border-white/20">
                <div className="size-9 rounded-lg bg-white/20 flex items-center justify-center"><f.icon className="size-4" /></div>
                <div>
                  <div className="font-semibold">{f.title}</div>
                  <div className="text-sm opacity-80">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

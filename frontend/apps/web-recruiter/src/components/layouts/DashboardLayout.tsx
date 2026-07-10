import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Search, Sparkles, Sun, Moon, ChevronDown, LogOut, UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button, NotificationPopover } from "@smart-cv/ui";
import type { LucideIcon } from "lucide-react";
import type { NotificationItem, NotificationFilter } from "@smart-cv/ui";
import { useRecruiterStore } from "@/store/useRecruiterStore";
import { useTranslation } from "@smart-cv/i18n";
import {
  RecruiterApi,
  type RecruiterResponse,
  useCreatePaymentOrder,
  useNotificationsList,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@smart-cv/api";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@smart-cv/ui";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface Props {
  role: "candidate" | "employer" | "admin";
  nav: NavItem[];
  userName: string;
  userRole: string;
}

const ROLE_HOME: Record<Props["role"], string> = {
  candidate: "/candidate",
  employer: "/employer",
  admin: "/admin",
};

export function DashboardLayout({ role, nav, userName }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const { i18n, t } = useTranslation();
  const theme = useRecruiterStore((s) => s.theme);
  const setTheme = useRecruiterStore((s) => s.setTheme);
  const language: "EN" | "VI" = i18n.language?.toUpperCase() === "VI" ? "VI" : "EN";
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [currentTime] = useState(() => Date.now());
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
    hiring: true,
    intelligence: true,
    account: true,
  });

  const { data: recruiterMe } = RecruiterApi.useGetMe1();
  const recruiter = recruiterMe?.data as RecruiterResponse | undefined;
  const { data: notifData } = useNotificationsList({ page: 1, pageSize: 30 });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const createOrderMutation = useCreatePaymentOrder();

  const notifications: NotificationItem[] = useMemo(() => {
    const items = notifData?.data?.items ?? [];
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      message: item.body,
      createdAt: item.createdAt,
      read: item.isRead,
      tone: ((): NotificationItem["tone"] => {
        if (item.type === "RECRUITER_APPROVED" || item.type === "JOB_APPROVED") return "success";
        if (item.type === "RECRUITER_REJECTED" || item.type === "JOB_REJECTED") return "danger";
        if (item.type === "RECRUITER_FEE_LOCKED") return "danger";
        if (item.type === "RECRUITER_FEE_DUE") return "warning";
        return "info";
      })(),
      url: item.data?.url,
    }));
  }, [notifData]);

  const unreadCount = notifData?.data?.unreadCount ?? 0;
  const feeDueAt = recruiter?.platformFeeDueAt ? new Date(recruiter.platformFeeDueAt) : null;
  const feeLockedAt = recruiter?.platformFeeLockedAt ? new Date(recruiter.platformFeeLockedAt) : null;
  const feeIsOverdue = feeDueAt ? feeDueAt.getTime() <= currentTime : false;
  const feeIsLocked = Boolean(feeLockedAt);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleLanguage = () => {
    const nextLanguage = language === "EN" ? "VI" : "EN";
    localStorage.setItem("smartcv_lang", nextLanguage.toLowerCase());
    i18n.changeLanguage(nextLanguage.toLowerCase());
  };

  const payPlatformFee = () => {
    createOrderMutation.mutate(
      { packageId: "fee" },
      {
        onSuccess: (res) => {
          if (res.data?.paymentUrl) {
            window.location.href = res.data.paymentUrl;
          }
        },
      }
    );
  };

  const navGroups = useMemo(() => ([
    {
      key: "overview",
      label: t("recruiter_sidebar_group_overview"),
      items: nav.filter((item) => item.to === ROLE_HOME[role]),
    },
    {
      key: "hiring",
      label: t("recruiter_sidebar_group_hiring"),
      items: nav.filter((item) => ["/employer/verification", "/employer/company-verification", "/employer/jobs", "/employer/applicants"].includes(item.to)),
    },
    {
      key: "intelligence",
      label: t("recruiter_sidebar_group_intelligence"),
      items: nav.filter((item) => ["/employer/cv-search", "/employer/assessments"].includes(item.to)),
    },
    {
      key: "account",
      label: t("recruiter_sidebar_group_account"),
      items: nav.filter((item) => ["/employer/profile", "/employer/billing", "/employer/notifications", "/employer/settings"].includes(item.to)),
    },
  ].filter((group) => group.items.length > 0)), [nav, role, t]);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "border-r border-sidebar-border bg-sidebar flex flex-col transition-all sticky top-0 h-screen",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="h-16 flex items-center gap-2 px-4 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            {!collapsed && <span className="font-bold tracking-tight">SmartCV</span>}
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-2">
          {navGroups.map((group) => {
            const groupHasActive = group.items.some((item) => pathname === item.to || (item.to !== ROLE_HOME[role] && pathname.startsWith(item.to)));
            if (group.items.length === 1) {
              const item = group.items[0];
              const active = pathname === item.to || (item.to !== ROLE_HOME[role] && pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link
                  key={group.key}
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-semibold border-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            }
            const expanded = collapsed ? false : (openGroups[group.key] ?? groupHasActive);
            return (
              <div key={group.key} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !expanded }))}
                  className={cn(
                    "flex w-full items-center rounded-lg px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-sidebar-accent",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {!collapsed && <span className="truncate">{group.label}</span>}
                  {!collapsed && <ChevronDown className={cn("ml-auto size-3.5 transition-transform", expanded && "rotate-180")} />}
                  {collapsed && <div className={cn("size-1.5 rounded-full", groupHasActive ? "bg-primary" : "bg-muted-foreground/40")} />}
                </button>
                {expanded && group.items.map((item) => {
                  const active = pathname === item.to || (item.to !== ROLE_HOME[role] && pathname.startsWith(item.to));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-primary font-semibold border-primary/20"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="m-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
        >
          {collapsed ? "→" : "← Thu gọn"}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-card flex items-center gap-3 px-4 lg:px-5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              placeholder={t("recruiter_search_placeholder")}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={toggleLanguage}
              className="border-border bg-muted/60 relative flex h-9 w-[84px] cursor-pointer items-center rounded-lg border p-1 text-xs"
              title={t("language")}
            >
              <span
                className={`absolute top-1 h-7 w-9 rounded-md bg-primary transition-transform duration-200 ${language === "EN" ? "translate-x-0" : "translate-x-[38px]"}`}
              />
              <span className={`relative z-10 w-9 text-center transition-colors duration-200 ${language === "EN" ? "text-primary-foreground" : "text-muted-foreground"}`}>EN</span>
              <span className={`relative z-10 w-9 text-center transition-colors duration-200 ${language === "VI" ? "text-primary-foreground" : "text-muted-foreground"}`}>VI</span>
            </button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="border-border bg-muted/60 text-muted-foreground h-9 w-9 transition-transform duration-300 active:scale-95"
              title={theme === "dark" ? t("light") : t("dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4 transition-transform duration-300 hover:rotate-12" /> : <Moon className="h-4 w-4 transition-transform duration-300 hover:-rotate-12" />}
            </Button>

            <NotificationPopover
              notifications={notifications}
              unreadCount={unreadCount}
              filter={filter}
              onFilterChange={setFilter}
              onMarkRead={(id) => markReadMutation.mutate(id)}
              onDelete={() => {}}
              onMarkAllRead={() => markAllReadMutation.mutate()}
              onClearAll={() => {}}
              onClickNotification={(id, url) => {
                const notifItem = notifData?.data?.items?.find((i) => i.id === id)
                if (notifItem && !notifItem.isRead) markReadMutation.mutate(id)
                if (url) window.location.href = url
              }}
              locale={language === "VI" ? "vi-VN" : "en-US"}
              triggerClassName="text-foreground hover:bg-accent"
              labels={{
                title: t("recruiter_nav_notifications"),
                all: t("notifications_filter_all"),
                unread: t("notifications_filter_unread"),
                read: t("notifications_filter_read"),
                markRead: t("notifications_mark_read"),
                delete: t("notifications_delete"),
                markAllRead: t("notifications_mark_all_read"),
                clearAll: t("notifications_clear_all"),
                empty: t("notifications_empty"),
                noUnread: t("notifications_no_unread"),
                unreadCount: t("notifications_unread_count", { count: unreadCount }),
                openNotifications: t("notifications_popup_aria"),
              }}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full bg-primary/20 border border-primary/30 px-3 py-1.5 cursor-pointer hover:bg-primary/25 transition-colors">
                  <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-primary">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{userName}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate({ to: "/employer/settings" })}>{t("account_settings")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/login" })}>
                  <LogOut className="size-4 mr-2" /> {t("account_sign_out")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {(role === "employer" && (feeIsOverdue || feeIsLocked)) && (
          <button
            type="button"
            onClick={payPlatformFee}
            className={cn(
              "border-b px-4 lg:px-5 py-3 text-left text-sm font-medium transition-colors",
              feeIsLocked
                ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/15"
                : "bg-warning/10 text-warning-foreground border-warning/20 hover:bg-warning/15",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {feeIsLocked ? "Tài khoản đã bị khóa do chưa thanh toán phí sàn" : "Phí sàn đã đến hạn thanh toán"}
                </div>
                <div className="text-xs opacity-80 mt-1">
                  {feeDueAt ? `Hạn thanh toán: ${feeDueAt.toLocaleDateString("vi-VN")}` : "Phí sàn hàng tháng: 10.000đ"}
                </div>
              </div>
              <Button size="sm" variant={feeIsLocked ? "destructive" : "default"} disabled={createOrderMutation.isPending}>
                Thanh toán ngay
              </Button>
            </div>
          </button>
        )}

        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

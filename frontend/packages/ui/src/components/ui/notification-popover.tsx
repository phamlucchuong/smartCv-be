import * as React from "react"
import { Bell, Trash2, MoreHorizontal } from "lucide-react"
import { cn } from "../../lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu"

export type NotificationFilter = "all" | "unread" | "read"
export type NotificationTone = "default" | "success" | "warning" | "danger" | "info"

export interface NotificationItem {
  id: string
  title: string
  message: string
  createdAt: string
  read: boolean
  tone?: NotificationTone
  url?: string
}

interface NotificationLabels {
  title: string
  all: string
  unread: string
  read: string
  markRead: string
  delete: string
  markAllRead: string
  clearAll: string
  empty: string
  noUnread: string
  unreadCount: string
  openNotifications: string
}

interface NotificationPopoverProps {
  notifications: NotificationItem[]
  unreadCount: number
  filter: NotificationFilter
  onFilterChange: (filter: NotificationFilter) => void
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
  onMarkAllRead: () => void
  onClearAll: () => void
  labels: NotificationLabels
  locale?: string
  triggerClassName?: string
  panelClassName?: string
  onClickNotification?: (id: string, url?: string) => void
}

const toneClasses: Record<NotificationTone, string> = {
  default: "bg-slate-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
}

function formatTimestamp(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function NotificationPopover({
  notifications,
  unreadCount,
  filter,
  onFilterChange,
  onMarkRead,
  onDelete,
  onMarkAllRead,
  onClearAll,
  labels,
  locale = "en-US",
  triggerClassName,
  panelClassName,
  onClickNotification,
}: NotificationPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (containerRef.current && !containerRef.current.contains(target)) {
        const targetElement = event.target as HTMLElement
        if (targetElement && typeof targetElement.closest === "function") {
          if (targetElement.closest("[data-radix-popper-content-wrapper]")) {
            return
          }
        }
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "unread") return !notification.read
    if (filter === "read") return notification.read
    return true
  })

  const summaryText = unreadCount > 0 ? labels.unreadCount : labels.noUnread

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={labels.openNotifications}
        onClick={() => setOpen((current) => !current)}
        className={cn("relative rounded-lg p-2 transition-colors hover:bg-accent", triggerClassName)}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={labels.title}
          className={cn(
            "absolute right-0 top-full z-50 mt-3 w-[min(92vw,24rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_48px_rgba(15,23,42,0.18)]",
            panelClassName,
          )}
        >
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{labels.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{summaryText}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={filter} onValueChange={(value) => onFilterChange(value as NotificationFilter)}>
                  <SelectTrigger className="w-[100px] h-8 text-xs bg-background">
                    <SelectValue placeholder={labels.all} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{labels.all}</SelectItem>
                    <SelectItem value="unread">{labels.unread}</SelectItem>
                    <SelectItem value="read">{labels.read}</SelectItem>
                  </SelectContent>
                </Select>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                      aria-label="Actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={onMarkAllRead}
                      disabled={unreadCount === 0}
                      className="text-xs cursor-pointer"
                    >
                      {labels.markAllRead}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={onClearAll}
                      disabled={notifications.length === 0}
                      className="text-xs text-destructive focus:text-destructive cursor-pointer"
                    >
                      {labels.clearAll}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="rounded-full bg-muted p-3 text-muted-foreground">
                  <Bell className="size-5" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">{labels.empty}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!notification.read) onMarkRead(notification.id)
                      onClickNotification?.(notification.id, notification.url)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        if (!notification.read) onMarkRead(notification.id)
                        onClickNotification?.(notification.id, notification.url)
                      }
                    }}
                    className={cn(
                      "group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 cursor-pointer overflow-hidden",
                      !notification.read && "bg-primary/[0.04]",
                    )}
                  >
                    {!notification.read ? (
                      <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", toneClasses[notification.tone ?? "default"])} />
                    ) : (
                      <div className="mt-1.5 size-2.5 shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-sm text-foreground", !notification.read && "font-semibold")}>
                            {notification.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground whitespace-normal break-words">
                            {notification.message}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatTimestamp(notification.createdAt, locale)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDelete(notification.id)
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-destructive opacity-0 translate-x-2 transition-all duration-200 ease-in-out group-hover:opacity-100 group-hover:translate-x-0"
                      aria-label={labels.delete}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

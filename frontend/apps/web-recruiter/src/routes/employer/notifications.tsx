import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { Bell } from "lucide-react";
import { Button, Card, CardContent } from "@smart-cv/ui";
import { useNotificationsList, useMarkNotificationRead, useMarkAllNotificationsRead } from "@smart-cv/api";

export const Route = createFileRoute("/employer/notifications")({
  head: () => ({ meta: [{ title: "Notifications" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading } = useNotificationsList({ page, pageSize: 20 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.data?.items ?? [];
  const meta = data?.data?.meta;
  const unreadCount = data?.data?.unreadCount ?? 0;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Notifications
          {unreadCount > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({unreadCount} unread)</span>
          )}
        </h1>
        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0 || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          Mark all as read
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading...</div>
      )}

      {!isLoading && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">No notifications yet.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <Card
            key={item.id}
            className={`cursor-pointer transition-colors hover:bg-muted/40 ${!item.isRead ? "border-primary/30 bg-primary/5" : ""}`}
            onClick={() => {
              if (!item.isRead) markRead.mutate(item.id)
              if (item.data?.url) window.location.href = item.data.url
            }}
          >
            <CardContent className="flex items-start gap-3 p-4">
              {!item.isRead && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
              <div className={`flex-1 ${item.isRead ? "pl-5" : ""}`}>
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{item.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {meta && meta.page < meta.totalPages && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

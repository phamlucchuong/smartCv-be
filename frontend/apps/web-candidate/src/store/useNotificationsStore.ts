import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { NotificationFilter, NotificationItem } from "@smart-cv/ui"

interface NotificationsState {
  filter: NotificationFilter
  notifications: NotificationItem[]
  setFilter: (filter: NotificationFilter) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  deleteNotification: (id: string) => void
  clearAll: () => void
}

const seedNotifications: NotificationItem[] = [
  {
    id: "candidate-1",
    title: "CV analysis completed",
    message: "Your latest CV upload has been analyzed and new improvement tips are available.",
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    read: false,
    tone: "success",
  },
  {
    id: "candidate-2",
    title: "Interview reminder",
    message: "Frontend Engineer interview with NovaLabs starts tomorrow at 09:00.",
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    read: false,
    tone: "warning",
  },
  {
    id: "candidate-3",
    title: "Application status updated",
    message: "Your application for Backend Java Developer moved to the shortlist stage.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    read: true,
    tone: "info",
  },
  {
    id: "candidate-4",
    title: "New job suggestion",
    message: "SmartCV found 12 roles matching your Java + Spring Boot profile.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    read: true,
    tone: "default",
  },
]

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      filter: "all",
      notifications: seedNotifications,
      setFilter: (filter) => set({ filter }),
      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.id === id ? { ...notification, read: true } : notification,
          ),
        })),
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((notification) => ({ ...notification, read: true })),
        })),
      deleteNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((notification) => notification.id !== id),
        })),
      clearAll: () => set({ notifications: [] }),
    }),
    {
      name: "web-candidate-notifications",
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

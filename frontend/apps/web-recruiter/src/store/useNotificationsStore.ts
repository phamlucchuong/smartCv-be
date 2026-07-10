import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { NotificationFilter } from "@smart-cv/ui";

interface NotificationsState {
  filter: NotificationFilter;
  setFilter: (filter: NotificationFilter) => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      filter: "all",
      setFilter: (filter) => set({ filter }),
    }),
    {
      name: "web-recruiter-notifications",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

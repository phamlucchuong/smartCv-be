import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { customInstance } from './axios-instance';

export interface NotificationApiItem {
  id: string;
  receiverId: string;
  receiverType: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationsPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface NotificationsListData {
  items: NotificationApiItem[];
  unreadCount: number;
  meta: NotificationsPaginationMeta;
}

export interface NotificationsListResponse {
  data: NotificationsListData;
  timestamp: string;
}

export type NotificationsListParams = {
  page?: number;
  pageSize?: number;
};

export const getNotifications = (
  params?: NotificationsListParams,
): Promise<NotificationsListResponse> =>
  customInstance({
    url: '/notification/api/notifications',
    method: 'GET',
    params,
  });

export const markNotificationRead = (id: string): Promise<unknown> =>
  customInstance({
    url: `/notification/api/notifications/${id}/read`,
    method: 'PATCH',
  });

export const markAllNotificationsRead = (): Promise<unknown> =>
  customInstance({
    url: '/notification/api/notifications/read-all',
    method: 'POST',
  });

export const deleteNotification = (id: string): Promise<unknown> =>
  customInstance({
    url: `/notification/api/notifications/${id}`,
    method: 'DELETE',
  });

export const NOTIFICATIONS_QUERY_KEY = ['/notification/api/notifications'] as const;

export const getNotificationsQueryKey = (params?: NotificationsListParams) =>
  [...NOTIFICATIONS_QUERY_KEY, ...(params ? [params] : [])] as const;

export const useNotificationsList = <
  TData = Awaited<ReturnType<typeof getNotifications>>,
  TError = unknown,
>(
  params?: NotificationsListParams,
  options?: { query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getNotifications>>, TError, TData>> },
) => {
  const { query: queryOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getNotificationsQueryKey(params);

  return useQuery<Awaited<ReturnType<typeof getNotifications>>, TError, TData>({
    queryKey,
    queryFn: () => getNotifications(params),
    ...queryOptions,
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
};

// Audience is always derived server-side from X-User-Scope — do not send it from the client.
export const subscribeFcmToken = (token: string): Promise<unknown> =>
  customInstance({
    url: '/notification/api/notifications/fcm/subscribe',
    method: 'POST',
    data: { token },
  });

export const unsubscribeFcmToken = (token: string): Promise<unknown> =>
  customInstance({
    url: '/notification/api/notifications/fcm/unsubscribe',
    method: 'DELETE',
    data: { token },
  });

import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { customInstance } from './axios-instance';

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export interface CreateOrderRequest {
  packageId: string;
}

export interface CreateOrderResponse {
  orderId: string;
  orderCode: number;
  paymentUrl: string;
  qrCode?: string;
}

export interface OrderResponse {
  orderId: string;
  orderCode: number;
  userRole: 'RECRUITER' | 'CANDIDATE';
  userId?: string;
  packageId: string;
  packageName: string;
  packageAiCredits: number;
  packageJobLimit: number;
  packageCvLimit: number;
  packageDurationDays?: number;
  amount: number;
  status: OrderStatus;
  paymentUrl: string;
  qrCode?: string;
  paymentType?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  ok?: boolean;
  code?: number;
  message?: string;
  data?: T;
}

export const createPaymentOrder = (
  data: CreateOrderRequest,
): Promise<ApiResponse<CreateOrderResponse>> =>
  customInstance({
    url: '/payment/api/orders',
    method: 'POST',
    data,
  });

export const getPaymentOrders = (
  page = 0,
  size = 10,
): Promise<ApiResponse<PageResponse<OrderResponse>>> =>
  customInstance({
    url: '/payment/api/orders',
    method: 'GET',
    params: { page, size },
  });

export const getAdminPaymentOrders = (
  page = 0,
  size = 10,
): Promise<ApiResponse<PageResponse<OrderResponse>>> =>
  customInstance({
    url: '/payment/api/orders/admin',
    method: 'GET',
    params: { page, size },
  });

export const getPaymentOrderById = (id: string): Promise<ApiResponse<OrderResponse>> =>
  customInstance({
    url: `/payment/api/orders/${id}`,
    method: 'GET',
  });

export const cancelPaymentOrder = (id: string): Promise<ApiResponse<void>> =>
  customInstance({
    url: `/payment/api/orders/${id}/cancel`,
    method: 'POST',
  });

export const cancelPaymentOrderByCode = (orderCode: number): Promise<ApiResponse<void>> =>
  customInstance({
    url: `/payment/api/orders/cancel-by-code`,
    method: 'POST',
    params: { orderCode },
  });

export const getGetPaymentOrdersQueryKey = (page: number, size: number) => ['/payment/api/orders', page, size] as const;
export const getGetAdminPaymentOrdersQueryKey = (page: number, size: number) => ['/payment/api/orders/admin', page, size] as const;
export const getGetPaymentOrderByIdQueryKey = (id: string) => [`/payment/api/orders/${id}`] as const;

export const useCreatePaymentOrder = <TError = unknown, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      ApiResponse<CreateOrderResponse>,
      TError,
      CreateOrderRequest,
      TContext
    >;
  },
) => {
  const mutationOptions = options?.mutation;

  return useMutation<ApiResponse<CreateOrderResponse>, TError, CreateOrderRequest, TContext>({
    mutationFn: (data) => createPaymentOrder(data),
    ...mutationOptions,
  });
};

export const useGetPaymentOrders = <
  TData = Awaited<ReturnType<typeof getPaymentOrders>>,
  TError = unknown,
>(
  page = 0,
  size = 10,
  options?: { query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getPaymentOrders>>, TError, TData>> },
) => {
  const { query: queryOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetPaymentOrdersQueryKey(page, size);

  return useQuery<Awaited<ReturnType<typeof getPaymentOrders>>, TError, TData>({
    queryKey,
    queryFn: () => getPaymentOrders(page, size),
    ...queryOptions,
  });
};

export const useGetAdminPaymentOrders = <
  TData = Awaited<ReturnType<typeof getAdminPaymentOrders>>,
  TError = unknown,
>(
  page = 0,
  size = 10,
  options?: { query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAdminPaymentOrders>>, TError, TData>> },
) => {
  const { query: queryOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetAdminPaymentOrdersQueryKey(page, size);

  return useQuery<Awaited<ReturnType<typeof getAdminPaymentOrders>>, TError, TData>({
    queryKey,
    queryFn: () => getAdminPaymentOrders(page, size),
    ...queryOptions,
  });
};

export const useGetPaymentOrderById = <
  TData = Awaited<ReturnType<typeof getPaymentOrderById>>,
  TError = unknown,
>(
  id: string,
  options?: { query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getPaymentOrderById>>, TError, TData>> },
) => {
  const { query: queryOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetPaymentOrderByIdQueryKey(id);

  return useQuery<Awaited<ReturnType<typeof getPaymentOrderById>>, TError, TData>({
    queryKey,
    queryFn: () => getPaymentOrderById(id),
    enabled: !!id && queryOptions?.enabled,
    ...queryOptions,
  });
};

export const useCancelPaymentOrder = <TError = unknown, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      ApiResponse<void>,
      TError,
      string,
      TContext
    >;
  },
) => {
  const mutationOptions = options?.mutation;

  return useMutation<ApiResponse<void>, TError, string, TContext>({
    mutationFn: (id) => cancelPaymentOrder(id),
    ...mutationOptions,
  });
};

export const useCancelPaymentOrderByCode = <TError = unknown, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      ApiResponse<void>,
      TError,
      number,
      TContext
    >;
  },
) => {
  const mutationOptions = options?.mutation;

  return useMutation<ApiResponse<void>, TError, number, TContext>({
    mutationFn: (orderCode) => cancelPaymentOrderByCode(orderCode),
    ...mutationOptions,
  });
};

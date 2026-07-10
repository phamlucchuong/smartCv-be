import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { customInstance } from './axios-instance';

export interface ServicePackageResponse {
  id?: string;
  name?: string;
  price?: number;
  aiCredits?: number;
  jobLimit?: number;
  cvLimit?: number;
  durationDays?: number;
  category?: string;
  featured?: boolean;
  features?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ServicePackageUpsertRequest {
  name: string;
  price: number;
  aiCredits: number;
  jobLimit: number;
  cvLimit: number;
  durationDays?: number;
  featured: boolean;
  features: string[];
}

export interface ApiResponseServicePackageResponse {
  ok?: boolean;
  code?: number;
  message?: string;
  data?: ServicePackageResponse;
}

export interface ApiResponseListServicePackageResponse {
  ok?: boolean;
  code?: number;
  message?: string;
  data?: ServicePackageResponse[];
}

export interface ApiResponseVoid {
  ok?: boolean;
  code?: number;
  message?: string;
}

export const getServicePackages = (): Promise<ApiResponseListServicePackageResponse> =>
  customInstance({
    url: '/api/packages',
    method: 'GET',
  });

export const createServicePackage = (
  data: ServicePackageUpsertRequest,
): Promise<ApiResponseServicePackageResponse> =>
  customInstance({
    url: '/api/packages',
    method: 'POST',
    data,
  });

export const updateServicePackage = (
  packageId: string,
  data: ServicePackageUpsertRequest,
): Promise<ApiResponseServicePackageResponse> =>
  customInstance({
    url: `/api/packages/${packageId}`,
    method: 'PUT',
    data,
  });

export const deleteServicePackage = (packageId: string): Promise<ApiResponseVoid> =>
  customInstance({
    url: `/api/packages/${packageId}`,
    method: 'DELETE',
  });

export const getGetServicePackagesQueryKey = () => ['/api/packages'] as const;

export const useGetServicePackages = <
  TData = Awaited<ReturnType<typeof getServicePackages>>,
  TError = unknown,
>(
  options?: { query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getServicePackages>>, TError, TData>> },
) => {
  const { query: queryOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetServicePackagesQueryKey();

  return useQuery<Awaited<ReturnType<typeof getServicePackages>>, TError, TData>({
    queryKey,
    queryFn: getServicePackages,
    ...queryOptions,
  });
};

export const useCreateServicePackage = <TError = unknown, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof createServicePackage>>,
      TError,
      ServicePackageUpsertRequest,
      TContext
    >;
  },
) => {
  const mutationOptions = options?.mutation;

  return useMutation<Awaited<ReturnType<typeof createServicePackage>>, TError, ServicePackageUpsertRequest, TContext>({
    mutationFn: (data) => createServicePackage(data),
    ...mutationOptions,
  });
};

export const useUpdateServicePackage = <TError = unknown, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof updateServicePackage>>,
      TError,
      { packageId: string; data: ServicePackageUpsertRequest },
      TContext
    >;
  },
) => {
  const mutationOptions = options?.mutation;

  return useMutation<
    Awaited<ReturnType<typeof updateServicePackage>>,
    TError,
    { packageId: string; data: ServicePackageUpsertRequest },
    TContext
  >({
    mutationFn: ({ packageId, data }) => updateServicePackage(packageId, data),
    ...mutationOptions,
  });
};

export const useDeleteServicePackage = <TError = unknown, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof deleteServicePackage>>,
      TError,
      string,
      TContext
    >;
  },
) => {
  const mutationOptions = options?.mutation;

  return useMutation<Awaited<ReturnType<typeof deleteServicePackage>>, TError, string, TContext>({
    mutationFn: (packageId) => deleteServicePackage(packageId),
    ...mutationOptions,
  });
};

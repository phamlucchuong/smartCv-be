import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { customInstance } from './axios-instance';
import type { ApiResponsePageResponseJobResponse } from './generated/job/model';

export type AdminJobsParams = {
  moderationStatus?: 'PENDING' | 'PUBLISHED';
  page?: number;
  size?: number;
  keyword?: string;
  category?: string;
};

export const getAdminJobs = (
  params?: AdminJobsParams,
  options?: object,
): Promise<ApiResponsePageResponseJobResponse> =>
  customInstance(
    {
      url: '/api/jobs/admin/all',
      method: 'GET',
      params,
    },
    options,
  );

export const getGetAdminJobsQueryKey = (params?: AdminJobsParams) =>
  ['/api/jobs/admin/all', ...(params ? [params] : [])] as const;

export const useGetAdminJobs = <TData = Awaited<ReturnType<typeof getAdminJobs>>, TError = unknown>(
  params?: AdminJobsParams,
  options?: { query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getAdminJobs>>, TError, TData>> },
) => {
  const { query: queryOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetAdminJobsQueryKey(params);

  return useQuery<Awaited<ReturnType<typeof getAdminJobs>>, TError, TData>({
    queryKey,
    queryFn: () => getAdminJobs(params),
    ...queryOptions,
  });
};

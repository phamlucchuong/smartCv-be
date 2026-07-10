import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { customInstance } from './axios-instance';
import type { ApplicationModels } from './index';

type RecruiterApplicationsResponse = ApplicationModels.ApiResponsePageResponseApplicationDetailResponse;

export interface GetRecruiterApplicationsParams {
  page?: number;
  size?: number;
}

export const getRecruiterApplicationsQueryKey = (params?: GetRecruiterApplicationsParams) =>
  ['/api/applications/recruiter', ...(params ? [params] : [])] as const;

export const getRecruiterApplications = (
  params?: GetRecruiterApplicationsParams,
  options?: Parameters<typeof customInstance>[1],
  signal?: AbortSignal,
) =>
  customInstance<RecruiterApplicationsResponse>(
    { url: '/api/applications/recruiter', method: 'GET', params, signal },
    options,
  );

export const useGetRecruiterApplications = <
  TData = Awaited<ReturnType<typeof getRecruiterApplications>>,
  TError = unknown,
>(
  params?: GetRecruiterApplicationsParams,
  options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getRecruiterApplications>>, TError, TData>>;
  },
) => {
  const { query: queryOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getRecruiterApplicationsQueryKey(params);
  const queryFn = ({ signal }: { signal?: AbortSignal }) => getRecruiterApplications(params, undefined, signal);
  return useQuery({ queryKey, queryFn, ...queryOptions });
};

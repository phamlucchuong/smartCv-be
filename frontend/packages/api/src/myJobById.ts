import { useQuery } from '@tanstack/react-query';
import { customInstance } from './axios-instance';
import type { ApiResponseJobResponse } from './generated/job/model';

export const getMyJobByIdQueryKey = (id: string) => [`/api/jobs/my/${id}`] as const;

export const useGetMyJobById = (id: string) =>
  useQuery({
    queryKey: getMyJobByIdQueryKey(id),
    queryFn: ({ signal }) =>
      customInstance<ApiResponseJobResponse>({
        url: `/api/jobs/my/${id}`,
        method: 'GET',
        signal,
      }),
    enabled: !!id,
  });

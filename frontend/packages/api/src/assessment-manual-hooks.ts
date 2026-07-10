import { useMutation } from '@tanstack/react-query';
import type { UseMutationOptions } from '@tanstack/react-query';
import { customInstance } from './axios-instance';

// Submit attempt with optional overtime flag (query param)
export const useSubmitAttemptWithFlag = <TError = unknown, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<void, TError, { attemptId: string; overtime?: boolean }, TContext> },
) => {
  const { mutation: mutationOptions } = options ?? {};
  return useMutation<void, TError, { attemptId: string; overtime?: boolean }, TContext>({
    mutationFn: ({ attemptId, overtime = false }) =>
      customInstance({
        url: `/api/attempts/${attemptId}/submit`,
        method: 'POST',
        params: overtime ? { overtime: 'true' } : undefined,
      }),
    ...mutationOptions,
  });
};






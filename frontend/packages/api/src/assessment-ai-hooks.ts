import { useMutation } from '@tanstack/react-query';
import type { UseMutationOptions } from '@tanstack/react-query';
import { customInstance } from './axios-instance';

export interface GeneratedQuestion {
  text: string;
  options: string[];
  correctOptionIndex: number;
}

export interface AssessmentGenerateRequest {
  jobName: string;
  level: string;
  difficulty: string;
  numQuestions: number;
  jobDescription?: string;
  jobSkills?: string;
  jobRequirements?: string;
}

export interface AssessmentGenerateApiResponse {
  data: { questions: GeneratedQuestion[] };
  message?: string;
  code?: number;
}

export const useGenerateAssessmentQuestions = <TError = unknown, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      AssessmentGenerateApiResponse,
      TError,
      AssessmentGenerateRequest,
      TContext
    >;
  },
) => {
  const { mutation: mutationOptions } = options ?? {};
  return useMutation<AssessmentGenerateApiResponse, TError, AssessmentGenerateRequest, TContext>({
    mutationFn: (request) =>
      customInstance<AssessmentGenerateApiResponse>({
        url: `/api/assessments/generate-questions`,
        method: 'POST',
        data: request,
      }),
    ...mutationOptions,
  });
};

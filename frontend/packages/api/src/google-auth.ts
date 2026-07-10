import { useMutation, type MutationFunction, type QueryClient, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query'
import { customInstance } from './axios-instance'

export interface GoogleAuthRequest {
  idToken: string
  role?: 'CANDIDATE' | 'RECRUITER'
}

export interface GoogleAuthResponse {
  ok?: boolean
  code?: number
  message?: string
  data?: {
    token?: string
    refreshToken?: string
    authenticated?: boolean
  }
}

export const authenticateWithGoogle = (
  googleAuthRequest: GoogleAuthRequest,
  signal?: AbortSignal,
) =>
  customInstance<GoogleAuthResponse>({
    url: '/user/api/auth/google',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: googleAuthRequest,
    signal,
  })

export const getAuthenticateWithGoogleMutationOptions = <TError = unknown, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof authenticateWithGoogle>>, TError, { data: GoogleAuthRequest }, TContext>
  },
): UseMutationOptions<Awaited<ReturnType<typeof authenticateWithGoogle>>, TError, { data: GoogleAuthRequest }, TContext> => {
  const mutationKey = ['authenticateWithGoogle']
  const mutationOptions = options?.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey
    ? options.mutation
    : { ...options?.mutation, mutationKey }

  const mutationFn: MutationFunction<Awaited<ReturnType<typeof authenticateWithGoogle>>, { data: GoogleAuthRequest }> = async (props) => {
    const { data } = props ?? {}
    return authenticateWithGoogle(data)
  }

  return { mutationFn, ...mutationOptions }
}

export const useAuthenticateWithGoogle = <TError = unknown, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof authenticateWithGoogle>>, TError, { data: GoogleAuthRequest }, TContext>
  },
  queryClient?: QueryClient,
): UseMutationResult<
  Awaited<ReturnType<typeof authenticateWithGoogle>>,
  TError,
  { data: GoogleAuthRequest },
  TContext
> => {
  const mutationOptions = getAuthenticateWithGoogleMutationOptions(options)
  return useMutation(mutationOptions, queryClient)
}

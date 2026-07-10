export const OTP_RESEND_SECONDS = 5 * 60

export function formatOtpCountdown(seconds: number) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
  const remainingSeconds = String(seconds % 60).padStart(2, '0')

  return `${minutes}:${remainingSeconds}`
}

import * as React from 'react'
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@smart-cv/ui'
import { toast } from 'sonner'
import { useVerifyCandidateRegistration, useResendRegistrationOtp } from '@smart-cv/api'
import type { RegisterRequestPreferredVerification, VerifyRegistrationRequestVerificationType } from '@smart-cv/api'
import { formatOtpCountdown, OTP_RESEND_SECONDS } from '../constants/otp'

interface OtpVerificationFormProps {
  email: string
  phone?: string
  onSuccess: () => void
  onClose: () => void
}



function maskContact(contact: string): string {
  if (!contact) return ''
  if (contact.includes('@')) {
    const [local, domain] = contact.split('@')
    if (local.length <= 2) {
      return `${local.charAt(0)}*@${domain}`
    }
    return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`
  }
  const cleanPhone = contact.trim()
  if (cleanPhone.length <= 6) {
    return `${cleanPhone.slice(0, 2)}***${cleanPhone.slice(-1)}`
  }
  return `${cleanPhone.slice(0, 4)}***${cleanPhone.slice(-3)}`
}

export function OtpVerificationForm({ email, phone = '', onSuccess, onClose }: OtpVerificationFormProps) {
  const [channel, setChannel] = React.useState<RegisterRequestPreferredVerification>('EMAIL')
  const [otpDigits, setOtpDigits] = React.useState<string[]>(Array(6).fill(''))
  const [otpCountdown, setOtpCountdown] = React.useState(0)
  const [otpError, setOtpError] = React.useState('')
  const [otpSent, setOtpSent] = React.useState(false)
  const otpInputRefs = React.useRef<(HTMLInputElement | null)[]>([])

  const verifyMutation = useVerifyCandidateRegistration()
  const resendMutation = useResendRegistrationOtp()

  const otpContact = channel === 'EMAIL' ? email : phone
  const otpType: VerifyRegistrationRequestVerificationType = channel === 'EMAIL' ? 'EMAIL' : 'SMS'

  // Timer Effect when OTP active
  React.useEffect(() => {
    if (otpCountdown <= 0) return
    const timer = setInterval(() => {
      setOtpCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [otpCountdown])

  async function handleSendOtp() {
    setOtpError('')
    if (channel === 'SMS' && !phone.trim()) {
      setOtpError('Số điện thoại không khả dụng để gửi SMS OTP.')
      return
    }
    try {
      await resendMutation.mutateAsync({
        data: { contact: otpContact, preferredVerification: otpType },
      })
      setOtpSent(true)
      setOtpCountdown(OTP_RESEND_SECONDS)
      toast.success('Mã OTP đã được gửi!')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setOtpError(e?.response?.data?.message ?? 'Không thể gửi mã OTP. Vui lòng thử lại.')
    }
  }

  function handleOtpChange(index: number, value: string) {
    const char = value.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = char
    setOtpDigits(next)
    if (char && index < 5) otpInputRefs.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''))
      otpInputRefs.current[5]?.focus()
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = otpDigits.join('')
    if (code.length < 6) return
    setOtpError('')
    try {
      await verifyMutation.mutateAsync({ data: { contact: otpContact, verificationType: otpType, code } })
      onSuccess()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setOtpError(e?.response?.data?.message ?? 'Mã OTP không hợp lệ. Vui lòng thử lại.')
    }
  }

  return (
    <form onSubmit={handleOtpSubmit} className="space-y-4">
      {/* 1. Chọn Kênh */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Nhận OTP qua:</span>
        <Select
          value={channel}
          onValueChange={(val) => {
            setChannel(val as RegisterRequestPreferredVerification)
            setOtpSent(false)
            setOtpDigits(Array(6).fill(''))
            setOtpError('')
          }}
          disabled={otpCountdown > 0}
        >
          <SelectTrigger className="w-[100px] h-8 text-xs bg-background text-foreground border-border">
            <SelectValue placeholder="Chọn kênh" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EMAIL">Email</SelectItem>
            <SelectItem value="SMS">SMS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 2. Ô Nhập OTP & Nút Xác thực */}
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground leading-relaxed break-all">
          {otpSent ? (
            <span>
              Nhập mã 6 chữ số đã được gửi tới <strong className="text-foreground">{maskContact(otpContact)}</strong>
            </span>
          ) : (
            <span>
              Mã OTP sẽ được gửi tới <strong className="text-foreground">{maskContact(otpContact)}</strong>. Nhấn "Gửi mã OTP" để nhận mã xác thực.
            </span>
          )}
        </div>
        <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
          {otpDigits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                otpInputRefs.current[i] = el
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              disabled={!otpSent}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
              className="h-12 w-10 rounded-md border border-input bg-background text-center text-lg font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-foreground disabled:opacity-50"
            />
          ))}
        </div>

        {otpError && <p className="text-center text-sm text-destructive">{otpError}</p>}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={resendMutation.isPending || otpCountdown > 0}
            className="text-xs font-bold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline transition-all duration-200"
          >
            {resendMutation.isPending
              ? 'Đang gửi...'
              : otpCountdown > 0
              ? `Gửi lại sau ${formatOtpCountdown(otpCountdown)}`
              : 'Gửi mã OTP'}
          </button>
        </div>

        <Button
          type="submit"
          className="h-10 w-full"
          disabled={!otpSent || otpDigits.join('').length < 6 || verifyMutation.isPending}
        >
          {verifyMutation.isPending ? 'Đang xác thực...' : 'Xác thực'}
        </Button>
      </div>

      {/* 4. Nút Quay Lại */}
      <div className="text-center text-sm">
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          Quay lại chỉnh sửa thông tin
        </button>
      </div>
    </form>
  )
}

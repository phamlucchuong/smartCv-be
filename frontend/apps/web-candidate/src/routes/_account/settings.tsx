import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from '@smart-cv/ui'
import { useTranslation } from '@smart-cv/i18n'
import { Bell, Settings, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  useGetSettings, useUpdateNotifications, useUpdatePrivacy,
  useChangeMyPassword, useUpdateUser, useDeleteMyAccount,
  getGetSettingsQueryKey, getGetCurrentUserQueryKey,
  useGetMe2, getGetMe2QueryKey,
  useSendUpdateOtp, useVerifyUpdateOtp,
} from '@smart-cv/api'
import { useQueryClient } from '@tanstack/react-query'
import { hasCandidateRole, useAuthStore } from '../../store/useAuthStore'
import { useCandidatePreferences } from '../../store/candidatePreferences'
import { usePushNotifications } from '../../hooks/usePushNotifications'

export const Route = createFileRoute('/_account/settings')({
  component: SettingsPage,
})

type SectionKey = 'account' | 'notifications_privacy'

function SettingsPage() {
  const { t } = useTranslation()
  const { language: lang } = useCandidatePreferences()
  const navigate = useNavigate()
  const { isAuthenticated, userId, role, signOut } = useAuthStore()
  const settingsQueryKey = React.useMemo(
    () => [...getGetSettingsQueryKey(), userId ?? 'anonymous', 'settings-page'] as const,
    [userId],
  )
  const { data: settingsData } = useGetSettings({
    query: { enabled: isAuthenticated && !!userId && hasCandidateRole(role), queryKey: settingsQueryKey },
  })
  const settingsPayload = settingsData?.data

  const { data: meData } = useGetMe2({ query: { enabled: isAuthenticated && hasCandidateRole(role), retry: false } })
  const me = meData?.data

  const queryClient = useQueryClient()
  const updateNotifMutation = useUpdateNotifications()
  const updatePrivacyMutation = useUpdatePrivacy()
  const changePasswordMutation = useChangeMyPassword()
  const updateUserMutation = useUpdateUser()
  const deleteAccountMutation = useDeleteMyAccount()

  const [activeSection, setActiveSection] = React.useState<SectionKey>('account')
  const [openDeleteDialog, setOpenDeleteDialog] = React.useState(false)

  // OTP Verification States
  const [otpDialog, setOtpDialog] = React.useState<{
    isOpen: boolean
    type: 'password' | 'email' | 'phone'
    contact: string
    verificationType: 'EMAIL' | 'PHONE'
    otpCode: string
    otpSent: boolean
  }>({
    isOpen: false,
    type: 'password',
    contact: '',
    verificationType: 'EMAIL',
    otpCode: '',
    otpSent: false,
  })

  const sendOtpMutation = useSendUpdateOtp()
  const verifyOtpMutation = useVerifyUpdateOtp()

  const triggerOtpVerification = (
    type: 'password' | 'email' | 'phone',
    contact: string,
    verificationType: 'EMAIL' | 'PHONE'
  ) => {
    setOtpDialog({
      isOpen: true,
      type,
      contact,
      verificationType,
      otpCode: '',
      otpSent: false,
    })
  }

  const handleSendOtp = () => {
    sendOtpMutation.mutate(
      {
        data: {
          contact: otpDialog.contact,
          preferredVerification: otpDialog.verificationType,
        },
      },
      {
        onSuccess: () => {
          toast.success(lang === 'VI' ? 'Đã gửi mã OTP thành công' : 'OTP sent successfully')
          setOtpDialog((prev) => ({ ...prev, otpSent: true }))
        },
        onError: () => {
          toast.error(lang === 'VI' ? 'Gửi OTP thất bại. Vui lòng thử lại.' : 'Failed to send OTP')
        },
      }
    )
  }

  const handleVerifyAndSubmit = () => {
    if (otpDialog.otpCode.length !== 6) {
      toast.error(lang === 'VI' ? 'Mã OTP phải có 6 chữ số' : 'OTP code must be 6 digits')
      return
    }

    verifyOtpMutation.mutate(
      {
        data: {
          contact: otpDialog.contact,
          verificationType: otpDialog.verificationType,
          code: otpDialog.otpCode,
        },
      },
      {
        onSuccess: () => {
          if (otpDialog.type === 'password') {
            changePasswordMutation.mutate(
              { data: { currentPassword, newPassword } },
              {
                onSuccess: () => {
                  toast.success(lang === 'VI' ? 'Mật khẩu đã được thay đổi' : 'Password updated successfully')
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setOtpDialog((prev) => ({ ...prev, isOpen: false }))
                },
                onError: () => toast.error(lang === 'VI' ? 'Mật khẩu hiện tại không đúng hoặc thay đổi thất bại' : 'Current password is incorrect or change failed'),
              }
            )
          } else if (otpDialog.type === 'email') {
            if (!userId) return
            updateUserMutation.mutate(
              { userId, data: { email } },
              {
                onSuccess: () => {
                  toast.success(lang === 'VI' ? 'Đã cập nhật email' : 'Email updated')
                  queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() })
                  queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
                  setOtpDialog((prev) => ({ ...prev, isOpen: false }))
                },
                onError: () => toast.error(lang === 'VI' ? 'Email đã tồn tại hoặc cập nhật thất bại' : 'Email already in use or update failed'),
              }
            )
          } else if (otpDialog.type === 'phone') {
            if (!userId) return
            updateUserMutation.mutate(
              { userId, data: { phone } },
              {
                onSuccess: () => {
                  toast.success(lang === 'VI' ? 'Đã cập nhật số điện thoại' : 'Phone number updated')
                  queryClient.invalidateQueries({ queryKey: getGetMe2QueryKey() })
                  setOtpDialog((prev) => ({ ...prev, isOpen: false }))
                },
                onError: () => toast.error(lang === 'VI' ? 'Số điện thoại đã tồn tại hoặc cập nhật thất bại' : 'Phone number already in use or update failed'),
              }
            )
          }
        },
        onError: () => {
          toast.error(lang === 'VI' ? 'Mã OTP không chính xác hoặc đã hết hạn' : 'Invalid or expired OTP')
        },
      }
    )
  }

  React.useEffect(() => {
    document.title = t('page_title_settings')
  }, [t])

  const [notifications, setNotifications] = React.useState({
    jobRecommendations: false,
    applicationUpdates: false,
    newMessages: false,
    promotionalEmails: false,
  })
  const [privacy, setPrivacy] = React.useState({
    publicProfile: false,
    showSalaryExpectation: false,
    activityStatus: false,
  })

  React.useEffect(() => {
    if (settingsPayload) {
      Promise.resolve().then(() => {
        setNotifications({
          jobRecommendations: settingsPayload.notifications?.emailJobSuggestions ?? false,
          applicationUpdates: settingsPayload.notifications?.emailApplicationUpdates ?? false,
          newMessages: settingsPayload.notifications?.pushNotifications ?? false,
          promotionalEmails: settingsPayload.notifications?.marketingEmails ?? false,
        })
        setPrivacy({
          publicProfile: settingsPayload.privacy?.showCvToRecruiters ?? false,
          showSalaryExpectation: settingsPayload.privacy?.showContactInfo ?? false,
          activityStatus: false,
        })
      })
    }
  }, [settingsPayload])

  const { subscribe, unsubscribe, initPushSubscription, currentPermission } = usePushNotifications()

  React.useEffect(() => { initPushSubscription() }, [initPushSubscription])

  const [pushPermDialog, setPushPermDialog] = React.useState<'pre-prompt' | 'blocked' | null>(null)
  const [isSubscribing, setIsSubscribing] = React.useState(false)

  const handleNotifToggle = (key: keyof typeof notifications) => {
    const next = { ...notifications, [key]: !notifications[key] }
    setNotifications(next)
    updateNotifMutation.mutate(
      { data: { emailJobSuggestions: next.jobRecommendations, emailApplicationUpdates: next.applicationUpdates, pushNotifications: next.newMessages, marketingEmails: next.promotionalEmails } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() }),
        onError: () => { setNotifications(notifications); toast.error('Failed to update notifications') },
      }
    )
  }

  const doSubscribe = async () => {
    setIsSubscribing(true)
    try {
      await subscribe()
      handleNotifToggle('newMessages')
      setPushPermDialog(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Push subscription failed:', msg)
      if (currentPermission() === 'denied') {
        setPushPermDialog('blocked')
      } else if (msg === 'Messaging unavailable') {
        setPushPermDialog(null)
        toast.error(
          lang === 'VI'
            ? 'Firebase chưa được cấu hình. Vui lòng liên hệ quản trị viên.'
            : 'Firebase is not configured. Please contact the administrator.'
        )
      } else {
        setPushPermDialog(null)
        toast.error(
          lang === 'VI'
            ? `Đăng ký thông báo thất bại: ${msg}`
            : `Failed to subscribe to notifications: ${msg}`
        )
      }
    } finally {
      setIsSubscribing(false)
    }
  }

  const handlePushToggle = async () => {
    if (!notifications.newMessages) {
      const perm = currentPermission()
      if (perm === 'denied') {
        setPushPermDialog('blocked')
        return
      }
      if (perm === 'granted') {
        await doSubscribe()
        return
      }
      setPushPermDialog('pre-prompt')
    } else {
      try {
        await unsubscribe()
      } catch (err) {
        console.error('Push unsubscription failed:', err)
      }
      handleNotifToggle('newMessages')
    }
  }

  const handlePrivacyToggle = (key: keyof Omit<typeof privacy, 'activityStatus'>) => {
    const next = { ...privacy, [key]: !privacy[key] }
    setPrivacy(next)
    updatePrivacyMutation.mutate(
      { data: { showCvToRecruiters: next.publicProfile, showContactInfo: next.showSalaryExpectation } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() }),
        onError: () => { setPrivacy(privacy); toast.error('Failed to update privacy settings') },
      }
    )
  }

  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')

  React.useEffect(() => {
    if (me) {
      Promise.resolve().then(() => {
        setEmail(me.email ?? '')
        setPhone(me.phone ?? '')
      })
    }
  }, [me])

  const menuItems: Array<{ key: SectionKey; label: string; icon: React.ReactNode }> = [
    { key: 'account', label: 'Account', icon: <Settings className="h-4 w-4" /> },
    { key: 'notifications_privacy', label: 'Notification & Privacy', icon: <Bell className="h-4 w-4" /> },
  ]

  const handlePasswordUpdate = () => {
    if (newPassword.length < 8) { toast.error(t('account_password_too_short')); return }
    if (newPassword !== confirmPassword) { toast.error(t('account_password_mismatch')); return }
    const contactEmail = me?.email
    if (!contactEmail) {
      toast.error(lang === 'VI' ? 'Tài khoản chưa có email để gửi mã OTP' : 'Account email is required to send OTP')
      return
    }
    triggerOtpVerification('password', contactEmail, 'EMAIL')
  }

  const handleEmailUpdate = () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast.error(t('account_email_invalid')); return }
    if (!userId) return
    triggerOtpVerification('email', email, 'EMAIL')
  }

  const handlePhoneUpdate = () => {
    if (!/^(0|\+84)(3|5|7|8|9)\d{8}$/.test(phone)) {
      toast.error(lang === 'VI' ? 'Số điện thoại không hợp lệ' : 'Invalid phone number')
      return
    }
    if (!userId) return
    triggerOtpVerification('phone', phone, 'PHONE')
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="p-4">
            <h1 className="mb-3 text-lg font-semibold text-foreground">Settings</h1>
            <hr className="mb-3 border-border" />
            <div className="flex gap-2 overflow-x-auto lg:flex-col">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${activeSection === item.key ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted/60'}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {activeSection === 'account' && (
          <Card>
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Account Settings</h2>
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Change Password</h3>
                <Input type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="new-password" />
                <Input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
                <Input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                <Button className="mt-2" onClick={handlePasswordUpdate}>Update Password</Button>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Email Address</h3>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Button variant="outline" onClick={handleEmailUpdate}>Update Email</Button>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">{t('profile_phone')}</h3>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Button variant="outline" onClick={handlePhoneUpdate}>
                  {lang === 'VI' ? 'Cập nhật số điện thoại' : 'Update Phone'}
                </Button>
              </div>
              <div className="pt-6 border-t border-border space-y-4">
                <h3 className="font-semibold text-destructive flex items-center gap-2">
                  <TriangleAlert className="h-5 w-5 text-destructive" /> Danger Zone
                </h3>
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <h4 className="font-semibold text-foreground">Delete Account</h4>
                  <p className="mt-2 text-sm text-muted-foreground">This action is permanent and cannot be undone.</p>
                  <Button variant="destructive" className="mt-3" onClick={() => setOpenDeleteDialog(true)}>Delete Account</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === 'notifications_privacy' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-xl font-semibold text-foreground">Notification Preferences</h2>
                <ToggleRow label="Job Recommendations" subLabel="Receive weekly curated job suggestions" checked={notifications.jobRecommendations} onToggle={() => handleNotifToggle('jobRecommendations')} />
                <ToggleRow label="Application Updates" subLabel="Get notified when employers view your profile" checked={notifications.applicationUpdates} onToggle={() => handleNotifToggle('applicationUpdates')} />
                <ToggleRow label="New Messages" subLabel="Notifications for new messages" checked={notifications.newMessages} onToggle={handlePushToggle} />
                <ToggleRow label="Promotional Emails" subLabel="Tips, resources and SmartCV updates" checked={notifications.promotionalEmails} onToggle={() => handleNotifToggle('promotionalEmails')} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 text-xl font-semibold text-foreground">Privacy Settings</h2>
                <ToggleRow label="Share CV with Recruiters" subLabel="Allow recruiters to view your CV" checked={privacy.publicProfile} onToggle={() => handlePrivacyToggle('publicProfile')} />
                <ToggleRow label="Show Contact Info" subLabel="Display your contact information on profile" checked={privacy.showSalaryExpectation} onToggle={() => handlePrivacyToggle('showSalaryExpectation')} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa tài khoản</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Bạn chắc chắn muốn xóa tài khoản và đăng xuất?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDeleteDialog(false)}>Hủy</Button>
            <Button
              variant="destructive"
              disabled={deleteAccountMutation.isPending}
              onClick={() => deleteAccountMutation.mutate(undefined, {
                onSuccess: () => { signOut(); toast.success(t('account_deleted_toast')); navigate({ to: '/signin' }) },
                onError: () => toast.error('Failed to delete account'),
              })}
            >Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push notification permission pre-prompt */}
      <Dialog open={pushPermDialog === 'pre-prompt'} onOpenChange={(open) => { if (!open) setPushPermDialog(null) }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              {lang === 'VI' ? 'Cho phép thông báo trình duyệt' : 'Allow Browser Notifications'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {lang === 'VI'
                ? 'SmartCV cần quyền thông báo từ trình duyệt để gửi cảnh báo tin nhắn mới đến bạn ngay cả khi bạn không mở trang web.'
                : 'SmartCV needs browser notification permission to deliver new message alerts even when you\'re not on the page.'}
            </p>
            <p className="text-sm text-muted-foreground">
              {lang === 'VI'
                ? 'Nhấn "Cho phép" và sau đó chấp nhận trong hộp thoại trình duyệt.'
                : 'Click "Allow" then accept in the browser prompt.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushPermDialog(null)}>
              {lang === 'VI' ? 'Hủy' : 'Cancel'}
            </Button>
            <Button onClick={doSubscribe} disabled={isSubscribing}>
              {isSubscribing
                ? (lang === 'VI' ? 'Đang xử lý...' : 'Processing...')
                : (lang === 'VI' ? 'Cho phép' : 'Allow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push notification blocked dialog */}
      <Dialog open={pushPermDialog === 'blocked'} onOpenChange={(open) => { if (!open) setPushPermDialog(null) }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-destructive" />
              {lang === 'VI' ? 'Thông báo đã bị chặn' : 'Notifications Blocked'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {lang === 'VI'
                ? 'Trình duyệt của bạn đang chặn thông báo từ SmartCV. Để nhận tin nhắn mới, hãy cấp lại quyền theo hướng dẫn dưới đây.'
                : 'Your browser is blocking notifications from SmartCV. To receive new message alerts, re-enable permission as follows.'}
            </p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-4">
              {lang === 'VI' ? (
                <>
                  <li>Nhấn vào biểu tượng khóa <span className="font-mono text-xs bg-muted px-1 rounded">🔒</span> trên thanh địa chỉ</li>
                  <li>Tìm mục <strong>Thông báo</strong> và chọn <strong>Cho phép</strong></li>
                  <li>Tải lại trang và bật lại tùy chọn này</li>
                </>
              ) : (
                <>
                  <li>Click the lock icon <span className="font-mono text-xs bg-muted px-1 rounded">🔒</span> in the address bar</li>
                  <li>Find <strong>Notifications</strong> and set it to <strong>Allow</strong></li>
                  <li>Reload the page and toggle this setting again</li>
                </>
              )}
            </ol>
          </div>
          <DialogFooter>
            <Button onClick={() => setPushPermDialog(null)}>
              {lang === 'VI' ? 'Đã hiểu' : 'Got it'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={otpDialog.isOpen} onOpenChange={(open) => setOtpDialog((prev) => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {otpDialog.type === 'password' && (lang === 'VI' ? 'Xác nhận thay đổi mật khẩu' : 'Confirm Password Change')}
              {otpDialog.type === 'email' && (lang === 'VI' ? 'Xác nhận thay đổi Email' : 'Confirm Email Change')}
              {otpDialog.type === 'phone' && (lang === 'VI' ? 'Xác nhận thay đổi Số điện thoại' : 'Confirm Phone Change')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            {!otpDialog.otpSent ? (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {lang === 'VI'
                    ? `Hệ thống sẽ gửi mã OTP xác thực đến thông tin liên hệ mới/hiện tại của bạn: `
                    : `We will send a verification OTP to the following address/phone: `}
                  <strong className="text-foreground">{otpDialog.contact}</strong>
                </p>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setOtpDialog((prev) => ({ ...prev, isOpen: false }))}>
                    {lang === 'VI' ? 'Hủy' : 'Cancel'}
                  </Button>
                  <Button
                    onClick={handleSendOtp}
                    disabled={sendOtpMutation.isPending}
                  >
                    {sendOtpMutation.isPending
                      ? (lang === 'VI' ? 'Đang gửi...' : 'Sending...')
                      : (lang === 'VI' ? 'Gửi mã OTP' : 'Send OTP')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {lang === 'VI'
                    ? `Mã xác thực đã được gửi đến: `
                    : `Verification code has been sent to: `}
                  <strong className="text-foreground">{otpDialog.contact}</strong>
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {lang === 'VI' ? 'Nhập mã OTP (6 chữ số)' : 'Enter OTP Code (6 digits)'}
                  </label>
                  <Input
                    type="text"
                    maxLength={6}
                    className="text-center tracking-[0.25em] font-mono text-lg"
                    value={otpDialog.otpCode}
                    onChange={(e) => setOtpDialog((prev) => ({ ...prev, otpCode: e.target.value.replace(/\D/g, '') }))}
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    disabled={sendOtpMutation.isPending}
                    onClick={handleSendOtp}
                  >
                    {lang === 'VI' ? 'Gửi lại OTP' : 'Resend OTP'}
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setOtpDialog((prev) => ({ ...prev, isOpen: false }))}>
                      {lang === 'VI' ? 'Hủy' : 'Cancel'}
                    </Button>
                    <Button
                      onClick={handleVerifyAndSubmit}
                      disabled={verifyOtpMutation.isPending || changePasswordMutation.isPending || updateUserMutation.isPending}
                    >
                      {verifyOtpMutation.isPending
                        ? (lang === 'VI' ? 'Đang xác thực...' : 'Verifying...')
                        : (lang === 'VI' ? 'Xác nhận & Lưu' : 'Verify & Save')}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ToggleRow({ label, subLabel, checked, onToggle }: { label: string; subLabel: string; checked: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{subLabel}</p>
      </div>
      <button type="button" onClick={onToggle} className={`relative h-6 w-10 cursor-pointer rounded-full transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-muted'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-5' : 'left-1'}`} />
      </button>
    </div>
  )
}

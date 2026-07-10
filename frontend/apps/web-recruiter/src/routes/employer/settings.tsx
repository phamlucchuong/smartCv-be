import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@smart-cv/ui";
import { useTranslation } from "@smart-cv/i18n";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { Bell, Settings, LogOut, Trash2 } from "lucide-react";
import { usePushNotifications } from "../../hooks/usePushNotifications";

export const Route = createFileRoute("/employer/settings")({
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: SettingsPage,
});

type SectionKey = 'account' | 'notifications';

function SettingsPage() {
  const { i18n, t } = useTranslation();
  const lang = i18n.language?.toUpperCase() === "VI" ? "VI" : "EN";
  const navigate = useNavigate();
  const signOut = useAuthStore((s) => s.signOut);
  const { subscribe, unsubscribe, initPushSubscription, currentPermission } = usePushNotifications();
  
  const [activeSection, setActiveSection] = React.useState<SectionKey>('account');
  const [pushEnabled, setPushEnabled] = React.useState(
    () => localStorage.getItem('smartcv_fcm_token') !== null
  );

  const [pushPermDialog, setPushPermDialog] = React.useState<'pre-prompt' | 'blocked' | null>(null);
  const [isSubscribing, setIsSubscribing] = React.useState(false);

  React.useEffect(() => {
    initPushSubscription().then(() => {
      setPushEnabled(localStorage.getItem('smartcv_fcm_token') !== null);
    });
  }, [initPushSubscription]);

  const doSubscribe = async () => {
    setIsSubscribing(true);
    try {
      await subscribe();
      setPushEnabled(true);
      setPushPermDialog(null);
      toast.success(lang === 'VI' ? 'Đã bật thông báo thành công.' : 'Push notifications enabled.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Push subscription failed:', msg);
      if (currentPermission() === 'denied') {
        setPushPermDialog('blocked');
      } else if (msg === 'Messaging unavailable') {
        setPushPermDialog(null);
        toast.error(
          lang === 'VI'
            ? 'Firebase chưa được cấu hình. Vui lòng liên hệ quản trị viên.'
            : 'Firebase is not configured. Please contact the administrator.'
        );
      } else {
        setPushPermDialog(null);
        toast.error(
          lang === 'VI'
            ? `Đăng ký thông báo thất bại: ${msg}`
            : `Failed to subscribe to notifications: ${msg}`
        );
      }
    } finally {
      setIsSubscribing(false);
    }
  };

  const handlePushToggle = async () => {
    if (!pushEnabled) {
      const perm = currentPermission();
      if (perm === 'denied') {
        setPushPermDialog('blocked');
        return;
      }
      if (perm === 'granted') {
        await doSubscribe();
        return;
      }
      setPushPermDialog('pre-prompt');
    } else {
      try {
        await unsubscribe();
        setPushEnabled(false);
        toast.success(lang === 'VI' ? 'Đã tắt thông báo.' : 'Push notifications disabled.');
      } catch (err) {
        console.error('Push unsubscription failed:', err);
      }
    }
  };

  const handleLogout = () => {
    signOut();
    toast.success(lang === 'VI' ? "Đăng xuất thành công" : "Logged out successfully");
    navigate({ to: "/login" });
  };

  const handleDeleteAccount = () => {
    if (window.confirm(lang === 'VI' ? "Bạn có chắc chắn muốn xóa tài khoản này? Hành động này không thể hoàn tác!" : "Are you sure you want to delete this account? This action cannot be undone!")) {
      toast.success(lang === 'VI' ? "Tài khoản của bạn đã được xóa thành công" : "Account deleted successfully");
      signOut();
      navigate({ to: "/login" });
    }
  };

  const menuItems: Array<{ key: SectionKey; label: string; icon: React.ReactNode }> = [
    { key: 'account', label: lang === 'VI' ? 'Tài khoản' : 'Account', icon: <Settings className="h-4 w-4" /> },
    { key: 'notifications', label: lang === 'VI' ? 'Cài đặt thông báo' : 'Notifications', icon: <Bell className="h-4 w-4" /> },
  ];

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
          <div className="space-y-6">
            {/* Account Info */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-semibold text-foreground">{t("recruiter_settings_account_info")}</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">{t("full_name")}</label>
                    <input defaultValue="Trần Thị HR" className="mt-1 w-full h-10 rounded-md border border-input px-3 text-sm bg-background" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t("email")}</label>
                    <input defaultValue="hr@fpt.com.vn" className="mt-1.5 w-full h-10 rounded-md border border-input px-3 text-sm bg-background text-muted-foreground" disabled />
                  </div>
                </div>
                <Button>{t("recruiter_save_changes")}</Button>
              </CardContent>
            </Card>

            {/* Logout Settings */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-semibold text-foreground">Đăng xuất tài khoản</h2>
                <p className="text-sm text-muted-foreground">
                  Đăng xuất khỏi tài khoản nhà tuyển dụng hiện tại trên thiết bị này.
                </p>
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
                </Button>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border border-destructive/20 bg-destructive/5">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-semibold text-destructive flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-destructive" /> Vùng nguy hiểm (Danger Zone)
                </h2>
                <p className="text-sm text-muted-foreground">
                  Một khi bạn xóa tài khoản, mọi dữ liệu liên quan đến tin tuyển dụng, ứng viên và cấu hình sẽ bị xóa vĩnh viễn và không thể khôi phục.
                </p>
                <Button variant="destructive" onClick={handleDeleteAccount}>
                  Xóa tài khoản
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === 'notifications' && (
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-foreground">Notification Preferences</h2>
              <ToggleRow 
                label="New Messages" 
                subLabel="Notifications for new messages" 
                checked={pushEnabled} 
                onToggle={handlePushToggle} 
              />
              <ToggleRow 
                label="Application Updates" 
                subLabel="Get notified when candidates apply to your jobs" 
                checked={pushEnabled} 
                onToggle={handlePushToggle} 
              />
            </CardContent>
          </Card>
        )}
      </div>

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
    </div>
  );
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

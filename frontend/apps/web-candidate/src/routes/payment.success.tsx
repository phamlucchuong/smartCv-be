import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import { Button, Card, CardContent } from '@smart-cv/ui'
import { CheckCircle2, ArrowRight } from 'lucide-react'

import { useAuthStore } from '../store/useAuthStore'

export const Route = createFileRoute('/payment/success')({
  component: PaymentSuccessPage,
})

function PaymentSuccessPage() {
  const { role } = useAuthStore()
  const [params] = React.useState(() => new URLSearchParams(window.location.search))
  const queryRole = params.get('role')
  const isRecruiter = queryRole === 'RECRUITER' || role === 'RECRUITER'

  React.useEffect(() => {
    document.title = 'Thanh toán thành công | SmartCV'
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6 text-center border border-border shadow-lg">
        <CardContent className="space-y-6 pt-6">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-success border border-success/20">
            <CheckCircle2 className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Thanh toán thành công!</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cảm ơn bạn đã tin tưởng sử dụng dịch vụ của SmartCV. Gói dịch vụ của bạn đã được kích hoạt thành công trên tài khoản.
            </p>
          </div>

          <div className="pt-4 border-t border-border flex flex-col gap-3">
            {isRecruiter ? (
              <a href="http://localhost:3001/employer/billing">
                <Button className="w-full gap-2">
                  Quay lại quản lý gói <ArrowRight className="size-4" />
                </Button>
              </a>
            ) : (
              <Link to="/billing">
                <Button className="w-full gap-2">
                  Quay lại quản lý gói <ArrowRight className="size-4" />
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

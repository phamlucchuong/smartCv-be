import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import { Button, Card, CardContent } from '@smart-cv/ui'
import { XCircle, ArrowRight } from 'lucide-react'

import { useAuthStore } from '../store/useAuthStore'
import { useCancelPaymentOrderByCode } from '@smart-cv/api'

export const Route = createFileRoute('/payment/cancel')({
  component: PaymentCancelPage,
})

function PaymentCancelPage() {
  const { role, isAuthenticated } = useAuthStore()
  const [params] = React.useState(() => new URLSearchParams(window.location.search))
  const queryRole = params.get('role')
  const isRecruiter = queryRole === 'RECRUITER' || role === 'RECRUITER'
  const cancelByCode = useCancelPaymentOrderByCode()

  React.useEffect(() => {
    document.title = 'Thanh toán đã bị hủy | SmartCV'

    if (!isAuthenticated) return

    const orderCode = params.get('orderCode')
    if (orderCode) {
      cancelByCode.mutate(Number(orderCode))
    }
  }, [cancelByCode, isAuthenticated, params])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6 text-center border border-border shadow-lg">
        <CardContent className="space-y-6 pt-6">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive-soft text-destructive border border-destructive/20">
            <XCircle className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Thanh toán đã bị hủy</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bạn đã hủy quá trình thanh toán đơn hàng này. Không có giao dịch chuyển tiền nào được thực hiện.
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

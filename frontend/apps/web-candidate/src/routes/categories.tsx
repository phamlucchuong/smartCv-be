import { createFileRoute, Link } from '@tanstack/react-router'
import * as React from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@smart-cv/ui'
import { JOB_CATEGORY_OPTIONS } from '@smart-cv/ui'
import { Layers3, Sparkles } from 'lucide-react'
import { useGetCategories } from '@smart-cv/api'

export const Route = createFileRoute('/categories')({
  component: CategoriesPage,
})

function CategoriesPage() {
  const { data: categoriesData, isLoading } = useGetCategories()
  const categories = categoriesData?.data ?? []

  const getCategoryJobCount = React.useCallback((code: string) => {
    const found = categories.find((c) => c.name === code)
    return found?.jobCount ?? 0
  }, [categories])

  React.useEffect(() => {
    document.title = 'Ngành nghề | SmartCV'
  }, [])

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 py-8 text-left">
      <div className="space-y-3">
        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1 px-3 py-1">
          <Sparkles className="h-3 w-3" />
          Tất cả ngành nghề
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight">Danh mục ngành nghề nổi bật</h1>
        <p className="text-lg text-muted-foreground">
          Khám phá cơ hội việc làm theo từng ngành nghề để phát triển sự nghiệp của bạn
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {JOB_CATEGORY_OPTIONS.map((opt) => {
          const count = getCategoryJobCount(opt.value)
          return (
            <Link
              key={opt.value}
              to="/jobs"
              search={{ q: undefined, location: undefined, page: 1, category: opt.value }}
            >
              <Card className="bg-card border-border hover:-translate-y-1 transition-all duration-300 h-full cursor-pointer hover:border-primary/50 flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="p-2 w-fit bg-primary/10 rounded-xl mb-2 text-primary">
                    <Layers3 className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg font-bold">{opt.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 flex-1 flex flex-col justify-between">
                  <p className="text-sm text-muted-foreground">
                    Xem danh sách các việc làm thuộc nhóm ngành {opt.label} ngay hôm nay.
                  </p>
                  <div className="flex items-center text-xs text-primary font-medium pt-2 shrink-0">
                    <span className="bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                      {isLoading ? '...' : `${count} việc làm đang tuyển`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="pt-6 flex justify-center">
        <Link to="/">
          <Button size="lg" variant="outline" className="px-8 font-semibold shadow-sm">
            Quay lại trang chủ
          </Button>
        </Link>
      </div>
    </div>
  )
}

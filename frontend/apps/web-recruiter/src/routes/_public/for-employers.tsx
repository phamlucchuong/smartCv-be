import { createFileRoute } from "@tanstack/react-router";
import { Building2, Brain, Users } from "lucide-react";
import { Button } from "@smart-cv/ui";

export const Route = createFileRoute("/_public/for-employers")({
  head: () => ({ meta: [{ title: "Dành cho nhà tuyển dụng — SmartCV" }] }),
  component: () => (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold">Tuyển dụng nhanh hơn 10 lần với AI</h1>
        <p className="mt-4 text-muted-foreground">Tự động sàng lọc, xếp hạng và quản lý ứng viên trên một nền tảng duy nhất.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button size="lg">Bắt đầu miễn phí</Button>
          <Button size="lg" variant="outline">Liên hệ tư vấn</Button>
        </div>
      </div>
      <div className="mt-16 grid md:grid-cols-3 gap-5">
        {[
          { icon: Brain, title: "AI Screening", desc: "Tự động chấm điểm CV và phân loại Qualified / Under Review / Not Qualified." },
          { icon: Users, title: "ATS Kanban", desc: "Quản lý pipeline phỏng vấn trực quan kiểu drag & drop." },
          { icon: Building2, title: "Verified Company", desc: "Xác minh doanh nghiệp giúp tăng độ tin cậy với ứng viên." },
        ].map((f) => (
          <div key={f.title} className="card-surface p-6">
            <f.icon className="size-8 text-primary" />
            <h3 className="font-semibold mt-3">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  ),
});

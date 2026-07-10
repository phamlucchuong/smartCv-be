import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@smart-cv/ui";

const PLANS = [
  { name: "Basic", price: "Miễn phí", perks: ["3 tin tuyển dụng/tháng", "AI Screening cơ bản", "Hỗ trợ email"] },
  { name: "Pro", price: "2,990,000₫/tháng", perks: ["20 tin tuyển dụng/tháng", "AI Screening nâng cao", "Truy cập CV Database", "Hỗ trợ ưu tiên"], featured: true },
  { name: "Premium", price: "Liên hệ", perks: ["Không giới hạn tin", "AI tuỳ chỉnh", "API tích hợp ATS", "Account Manager"] },
];

export const Route = createFileRoute("/_public/pricing")({
  head: () => ({ meta: [{ title: "Bảng giá — SmartCV" }] }),
  component: () => (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Chọn gói phù hợp với bạn</h1>
        <p className="mt-3 text-muted-foreground">Linh hoạt, dễ nâng cấp, huỷ bất cứ lúc nào.</p>
      </div>
      <div className="mt-12 grid md:grid-cols-3 gap-5">
        {PLANS.map((p) => (
          <div key={p.name} className={`card-surface p-6 ${p.featured ? "ring-2 ring-primary" : ""}`}>
            {p.featured && <div className="inline-block rounded-full bg-primary text-primary-foreground text-xs px-2 py-0.5 mb-2">Phổ biến</div>}
            <h3 className="text-xl font-bold">{p.name}</h3>
            <div className="mt-2 text-2xl font-bold text-primary">{p.price}</div>
            <ul className="mt-5 space-y-2 text-sm">
              {p.perks.map((perk) => (
                <li key={perk} className="flex gap-2"><CheckCircle2 className="size-4 text-success" /> {perk}</li>
              ))}
            </ul>
            <Button className="w-full mt-6" variant={p.featured ? "default" : "outline"}>Chọn gói</Button>
          </div>
        ))}
      </div>
    </div>
  ),
});

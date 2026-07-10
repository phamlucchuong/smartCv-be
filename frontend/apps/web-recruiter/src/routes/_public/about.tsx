import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_public/about")({
  head: () => ({ meta: [{ title: "Về SmartCV" }] }),
  component: () => (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-bold">Về SmartCV</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        SmartCV là nền tảng tuyển dụng ứng dụng AI giúp kết nối ứng viên và nhà tuyển dụng dựa trên mức độ phù hợp thực tế của kỹ năng.
      </p>
      <div className="mt-10 grid md:grid-cols-3 gap-5">
        {[
          { k: "200+", v: "Doanh nghiệp" },
          { k: "50,000+", v: "Việc làm" },
          { k: "1M+", v: "CV được phân tích" },
        ].map((s) => (
          <div key={s.v} className="card-surface p-6 text-center">
            <div className="text-3xl font-bold text-primary">{s.k}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  ),
});

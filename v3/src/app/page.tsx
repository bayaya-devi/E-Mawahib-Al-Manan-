const foundations = [
  ["الهوية والصلاحيات", "Supabase Auth + RBAC + RLS"],
  ["البنية", "Next.js App Router + TypeScript"],
  ["الجودة", "Lint + Typecheck + Tests + Build"],
  ["الترحيل", "خطة تدريجية تحافظ على بيانات V1"],
] as const;

export default function FoundationStatusPage() {
  return (
    <main className="foundation-shell">
      <section className="foundation-panel" aria-labelledby="foundation-title">
        <p className="foundation-kicker">E-Mawahib Al-Manan</p>
        <h1 id="foundation-title">الأساس التقني للإصدار الثالث</h1>
        <p className="foundation-summary">
          مساحة تطوير مستقلة وآمنة. لم يتم نقل وظائف الإصدار الحالي بعد.
        </p>
        <dl className="foundation-grid">
          {foundations.map(([term, description]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

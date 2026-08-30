import { ArrowLeft, ShieldCheck } from "lucide-react";

import { PublicShell } from "@/components/shell";
import { Badge, ButtonLink } from "@/components/ui";

export default function PublicPage() {
  return (
    <PublicShell>
      <section className="public-hero" aria-labelledby="public-title">
        <div>
          <Badge tone="brand"><ShieldCheck aria-hidden="true" size={14} />بيئة تعليمية موثوقة</Badge>
          <h1 id="public-title">التعلّم والمتابعة في مساحة واحدة هادئة</h1>
          <p>واجهة عربية واضحة تجمع الطالب والأسرة والمعلّم والإدارة، وتحفظ لكل مستخدم مساحته وصلاحياته.</p>
          <div className="public-hero__actions">
            <ButtonLink href="/student">الدخول إلى المنصة <ArrowLeft aria-hidden="true" size={18} /></ButtonLink>
            <ButtonLink href="/design-system" variant="secondary">مرجع الواجهة</ButtonLink>
          </div>
        </div>
        <div className="public-hero__signal" aria-label="هوية مواهب المنان">
          <span aria-hidden="true">م</span>
          <strong>معرفةٌ تُبنى<br />بخطوات ثابتة</strong>
        </div>
      </section>
      <section className="public-band" id="about">
        <p>من الطالب إلى الإدارة</p>
        <h2>تجربة واحدة، ومساحات مصممة بحسب المسؤولية.</h2>
      </section>
      <section className="public-details" id="program">
        <span>البرنامج</span>
        <h2>التعلّم، المتابعة، التدريس والإدارة ضمن بنية موحّدة.</h2>
      </section>
      <section className="public-details" id="contact">
        <span>تواصل معنا</span>
        <h2>تُعرض بيانات التواصل المعتمدة عند ربط المحتوى المؤسسي.</h2>
      </section>
    </PublicShell>
  );
}

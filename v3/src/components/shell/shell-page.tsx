import { ArrowLeft, Sparkles } from "lucide-react";

import { Badge, Button, EmptyState } from "@/components/ui";
import type { ShellKind } from "./app-shell";

const content: Record<ShellKind, { eyebrow: string; title: string; summary: string; empty: string }> = {
  student: { eyebrow: "خطوتك التالية", title: "ابدأ من حيث توقفت", summary: "يظهر هنا المسار والواجبات بعد تحميل بيانات حسابك.", empty: "لم تُحمّل بيانات التعلّم بعد" },
  family: { eyebrow: "متابعة واضحة", title: "كل ما يهم الأسرة في مكان واحد", summary: "تظهر المتابعة والرسائل بعد اختيار حساب الابن أو الابنة.", empty: "لم يتم اختيار حساب للمتابعة" },
  teacher: { eyebrow: "يوم دراسي منظّم", title: "ركّز على الطالب والتسميع", summary: "تظهر الجلسات والمهام المصرّح بها بعد تسجيل الدخول.", empty: "لا توجد جلسة مفتوحة الآن" },
  admin: { eyebrow: "مركز الإدارة", title: "قرار واضح من بيانات موثوقة", summary: "تظهر المؤشرات والتنبيهات بعد اتصال مصدر البيانات المعتمد.", empty: "لا توجد بيانات إدارية معروضة" },
};

export function ShellPage({ kind }: { kind: ShellKind }) {
  const copy = content[kind];
  return (
    <>
      <section className="page-intro">
        <div><Badge tone="brand"><Sparkles aria-hidden="true" size={14} />{copy.eyebrow}</Badge><h1>{copy.title}</h1><p>{copy.summary}</p></div>
        <Button variant="secondary">عرض التفاصيل <ArrowLeft aria-hidden="true" size={18} /></Button>
      </section>
      <section className="content-section" aria-labelledby="workspace-title">
        <div className="section-heading"><div><span>المساحة الحالية</span><h2 id="workspace-title">نظرة موجزة</h2></div></div>
        <EmptyState title={copy.empty} description="ستظهر المعلومات الحقيقية هنا فور توافرها، من دون أمثلة دائمة أو أرقام مصطنعة." />
      </section>
    </>
  );
}

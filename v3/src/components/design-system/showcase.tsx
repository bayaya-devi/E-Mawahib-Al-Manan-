"use client";

import { Bell, BookOpen, Mail, Menu, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  Dialog,
  Drawer,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Select,
  Skeleton,
  Table,
  ToastProvider,
  useToast,
} from "@/components/ui";

export function DesignSystemShowcase() {
  return <ToastProvider><ShowcaseContent /></ToastProvider>;
}

function ShowcaseContent() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { showToast } = useToast();
  return (
    <main className="ds-page" id="main-content">
      <header className="ds-header">
        <Link className="brand-mark" href="/"><span aria-hidden="true">م</span><strong>نظام مواهب المنان</strong></Link>
        <div><Badge tone="brand">الإصدار 3</Badge><IconButton label="فتح القائمة" onClick={() => setDrawerOpen(true)}><Menu aria-hidden="true" /></IconButton></div>
      </header>

      <section className="ds-intro">
        <span>مرجع الواجهة</span><h1>لغة بصرية عربية، هادئة ودقيقة.</h1>
        <p>هذا المرجع مخصّص لبناء الشاشات الجديدة بنفس القواعد، لا لعرض بيانات تشغيلية.</p>
      </section>

      <section className="ds-section" aria-labelledby="colors"><Heading id="colors" index="01" title="اللون والطباعة" />
        <div className="ds-swatches">
          {[['حبر أخضر','var(--brand)'],['عاجي دافئ','var(--canvas)'],['فحم','var(--ink)'],['ذهب مطفأ','var(--gold)'],['خمري','var(--plum)']].map(([name, color]) => (
            <div key={name}><span style={{ background: color }} /><strong>{name}</strong></div>
          ))}
        </div>
        <div className="ds-type"><h2>عنوان عربي واضح</h2><p>نص مريح للقراءة اليومية على الشاشات الصغيرة والكبيرة، بوزن متوازن ومسافات محسوبة.</p><small>تفاصيل مساعدة وعناصر واجهة مضغوطة</small></div>
      </section>

      <section className="ds-section" aria-labelledby="actions"><Heading id="actions" index="02" title="الأوامر والحالات" />
        <div className="ds-row"><Button>حفظ التغييرات</Button><Button variant="secondary">إلغاء</Button><Button variant="quiet">عرض المزيد</Button><Button variant="danger">حذف</Button><Button loading>جارٍ الحفظ</Button></div>
        <div className="ds-row"><Badge tone="success">مكتمل</Badge><Badge tone="warning">يحتاج متابعة</Badge><Badge tone="danger">متوقف</Badge><Badge tone="brand">نشط</Badge><Avatar name="أحمد العلوي" /><Avatar name="مريم" size="lg" /></div>
      </section>

      <section className="ds-section" aria-labelledby="forms"><Heading id="forms" index="03" title="الحقول والنماذج" />
        <div className="ds-form-grid"><Input label="الاسم الكامل" placeholder="اكتب الاسم" icon={UserRound} /><Input label="البريد الإلكتروني" type="email" placeholder="name@example.com" icon={Mail} hint="لن يظهر هذا العنوان للطلاب." /><Select label="الحالة" defaultValue=""><option value="" disabled>اختر الحالة</option><option value="active">نشط</option><option value="pending">قيد المراجعة</option></Select><Input label="حقل غير صحيح" defaultValue="قيمة" error="راجع هذه القيمة." /></div>
      </section>

      <section className="ds-section" aria-labelledby="overlays"><Heading id="overlays" index="04" title="النوافذ والتنبيهات" />
        <div className="ds-row">
          <Dialog title="تأكيد الإجراء" description="راجع المعلومات قبل المتابعة." trigger={<Button variant="secondary">فتح نافذة</Button>}><p>المحتوى الحقيقي يوضع هنا عند ربط حالة الاستخدام.</p><Button>تأكيد</Button></Dialog>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>فتح اللوحة</Button>
          <Button onClick={() => showToast({ title: "تم الحفظ", description: "حُفظت التغييرات بنجاح.", tone: "success" })}>عرض إشعار</Button>
        </div>
      </section>

      <section className="ds-section" aria-labelledby="data"><Heading id="data" index="05" title="البيانات والتحميل" />
        <Table caption="جدول بلا بيانات تجريبية"><thead><tr><th>الاسم</th><th>الحالة</th><th>آخر تحديث</th></tr></thead><tbody><tr><td colSpan={3}>لا توجد بيانات متاحة.</td></tr></tbody></Table>
        <div className="ds-skeletons"><Skeleton /><Skeleton /><Skeleton /></div>
      </section>

      <section className="ds-section" aria-labelledby="states"><Heading id="states" index="06" title="الفراغ والخطأ" />
        <div className="ds-state-grid"><Card><EmptyState icon={BookOpen} title="لا يوجد محتوى بعد" description="سيظهر المحتوى فور إضافته من مصدره المعتمد." action={<Button size="sm">إضافة</Button>} /></Card><Card><ErrorState title="تعذّر تحميل البيانات" description="تحقق من الاتصال ثم أعد المحاولة." action={<Button variant="secondary" size="sm">إعادة المحاولة</Button>} /></Card></div>
      </section>

      <section className="ds-section" aria-labelledby="shells"><Heading id="shells" index="07" title="مساحات التطبيق" />
        <nav className="ds-shell-links" aria-label="معاينة المساحات">{([['الواجهة العامة','/'],['الطالب','/student'],['الأسرة','/family'],['المعلّم','/teacher'],['الإدارة','/admin']] as const).map(([label, href]) => <ButtonLink key={label} href={href} variant="secondary">{label}</ButtonLink>)}</nav>
      </section>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="لوحة جانبية"><p>تُستخدم للمهام الثانوية على الهاتف، مع حجز التركيز وإغلاقها بزر Escape.</p><div className="ds-row"><IconButton label="بحث"><Search aria-hidden="true" /></IconButton><IconButton label="إشعارات"><Bell aria-hidden="true" /></IconButton></div></Drawer>
    </main>
  );
}

function Heading({ id, index, title }: { id: string; index: string; title: string }) {
  return <div className="ds-heading"><span>{index}</span><h2 id={id}>{title}</h2></div>;
}

import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "@/features/identity/login-form";

export const metadata = { title: "تسجيل الدخول · مواهب المنان" };

export default function LoginPage() {
  return <main className="login-v3" dir="rtl" lang="ar">
    <section className="login-v3__brand">
      <Image src="/dar-al-hadith/logo.webp" alt="جمعية مواهب المنان" width={112} height={108} priority />
      <div><span>جمعية مواهب المنان · عين العودة</span><h1>منصة دار القرآن والحديث</h1><Link href="/ar">زيارة الموقع</Link></div>
    </section>
    <section className="login-v3__panel"><header><span>مرحبا بك</span><h2>تسجيل الدخول</h2><p>أدخل بياناتك للوصول إلى منصتك.</p></header><LoginForm /></section>
  </main>;
}

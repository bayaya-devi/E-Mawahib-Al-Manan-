import Image from "next/image";
import Link from "next/link";
import { House } from "lucide-react";

import { LoginForm } from "@/features/identity/login-form";

export const metadata = { title: "تسجيل الدخول · مواهب المنان" };

export default function LoginPage() {
  return <main className="login-v3" dir="rtl" lang="ar">
    <section className="login-v3__brand">
      <Image src="/dar-al-hadith/logo.webp" alt="جمعية مواهب المنان" width={112} height={108} priority />
      <Link className="login-v3__visit login-v3__visit--desktop" href="/ar"><House aria-hidden="true" size={18} />زيارة الموقع</Link>
    </section>
    <section className="login-v3__panel">
      <Image className="login-v3__mobile-logo" src="/dar-al-hadith/logo.webp" alt="جمعية مواهب المنان" width={72} height={70} priority />
      <header><h2>تسجيل الدخول</h2></header>
      <LoginForm />
    </section>
  </main>;
}

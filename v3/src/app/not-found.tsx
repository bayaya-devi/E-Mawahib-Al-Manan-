import Link from "next/link";

export default function NotFound() {
  return <main className="fatal-state" id="main-content"><div><span>404</span><h1>الصفحة غير موجودة</h1><p>Page introuvable · Page not found</p><Link href="/ar">العودة إلى الصفحة الرئيسية</Link></div></main>;
}

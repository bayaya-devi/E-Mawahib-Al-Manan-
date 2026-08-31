"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="ar" dir="rtl"><body><main className="fatal-state" role="alert"><div><h1>حدث عطل مؤقت</h1><p>لم تُحذف بياناتك. أعد المحاولة بعد التحقق من الاتصال.</p><button type="button" onClick={reset}>إعادة المحاولة</button></div></main></body></html>;
}

"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Setup = { factorId: string; qrCode: string | null; secret: string | null };
export function MfaWorkspace() {
  const search = useSearchParams(); const [setup, setSetup] = useState<Setup | null>(null); const [code, setCode] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(true);
  const requested = search.get("next") ?? "/admin"; const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/admin";
  useEffect(() => {
    let active = true; const client = createClient();
    void Promise.all([client.auth.mfa.getAuthenticatorAssuranceLevel(), client.auth.mfa.listFactors()]).then(async ([assurance, factors]) => {
      if (!active) return; if (assurance.data?.currentLevel === "aal2") { window.location.replace(next); return; }
      const existing = factors.data?.totp.find((factor) => factor.status === "verified");
      if (existing) setSetup({ factorId: existing.id, qrCode: null, secret: null });
      else { const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "e-Mawahib Command" }); if (enrolled.data) setSetup({ factorId: enrolled.data.id, qrCode: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret }); else setError("تعذر إعداد التحقق الآن."); }
      setBusy(false);
    });
    return () => { active = false; };
  }, [next]);
  async function verify(): Promise<void> {
    if (!setup || !/^\d{6}$/u.test(code)) return; setBusy(true); setError("");
    const result = await createClient().auth.mfa.challengeAndVerify({ factorId: setup.factorId, code });
    if (result.error) { setError("الرمز غير صحيح أو انتهت صلاحيته."); setBusy(false); return; }
    window.location.replace(next);
  }
  return <section className="mfa-page"><div className="mfa-panel"><span>حماية الإدارة</span><h1>تحقق بخطوتين</h1><p>يلزم رمز مؤقت لحماية بيانات المؤسسة.</p>{setup?.qrCode ? <div className="mfa-setup"><Image src={setup.qrCode} width={210} height={210} alt="رمز إعداد تطبيق المصادقة" unoptimized /><small>امسح الرمز بتطبيق المصادقة، أو أدخل المفتاح: <b dir="ltr">{setup.secret}</b></small></div> : null}<Input label="رمز التحقق" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} {...(error ? { error } : {})} onChange={(event) => setCode(event.target.value.replace(/\D/gu, ""))} /><Button loading={busy} disabled={!setup || code.length !== 6} onClick={() => void verify()}>متابعة آمنة</Button></div></section>;
}

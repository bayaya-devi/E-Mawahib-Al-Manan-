"use client";

import { Eye, EyeOff, Home, LogIn, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AccountKind = "student" | "teacher";

function cleanPart(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[\u064B-\u065F\u0670]/gu, "")
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replace(/['’`´]/gu, "")
    .replace(/[^a-z0-9\u0600-\u06FF]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

export function LoginForm() {
  const router = useRouter();
  const [kind, setKind] = useState<AccountKind>("student");
  const [firstName, setFirstName] = useState("");
  const [secondValue, setSecondValue] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const prefix = kind === "student" ? "s" : "t";
    const login = `${prefix}_${cleanPart(firstName)}.${cleanPart(secondValue)}`;
    if (login.length < 3 || !password) {
      setMessage("يرجى ملء جميع الحقول.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const result = (await response.json()) as { ok?: boolean; roles?: string[]; message?: string };
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "تعذر تسجيل الدخول. حاول مرة أخرى.");
        return;
      }
      const roles = result.roles ?? [];
      const destination = roles.includes("direction") || roles.includes("admin")
        ? "/admin"
        : roles.includes("teacher")
          ? "/teacher"
        : "/student";
      router.replace(destination);
      router.refresh();
    } catch {
      setMessage("تعذر الاتصال الآن. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="login-v3__form" onSubmit={submit} noValidate>
    <fieldset className="login-v3__roles">
      <legend>نوع الحساب</legend>
      <button type="button" className={kind === "student" ? "is-active" : undefined} onClick={() => { setKind("student"); setMessage(""); }}>تلميذ</button>
      <button type="button" className={kind === "teacher" ? "is-active" : undefined} onClick={() => { setKind("teacher"); setMessage(""); }}>أستاذ</button>
    </fieldset>
    <label><span>الاسم</span><span className="login-v3__control"><UserRound aria-hidden="true" size={20} /><input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required /></span></label>
    <label><span>{kind === "teacher" ? "القسم" : "الاسم العائلي"}</span><span className="login-v3__control"><UserRound aria-hidden="true" size={20} /><input value={secondValue} onChange={(event) => setSecondValue(event.target.value)} autoComplete={kind === "teacher" ? "organization" : "family-name"} required /></span></label>
    <label><span>كلمة المرور</span><span className="login-v3__control"><input dir="ltr" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button type="button" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></span></label>
    {message && <p className="login-v3__message" role="alert">{message}</p>}
    <div className="login-v3__actions">
      <Link className="login-v3__visit login-v3__visit--mobile" href="/ar"><Home aria-hidden="true" size={18} />زيارة الموقع</Link>
      <button className="login-v3__submit" type="submit" disabled={busy}><LogIn aria-hidden="true" size={20} />{busy ? "جار التحقق..." : "دخول"}</button>
    </div>
    <p className="login-v3__help">إذا لم تكن لديك معلومات الدخول، تواصل مع الإدارة.</p>
  </form>;
}

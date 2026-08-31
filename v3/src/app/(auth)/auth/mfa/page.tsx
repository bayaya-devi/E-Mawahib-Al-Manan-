import type { Metadata } from "next";
import { Suspense } from "react";
import { MfaWorkspace } from "@/features/identity/application/mfa-workspace";
export const metadata: Metadata = { title: "التحقق الإداري" };
export default function Page() { return <main id="main-content"><Suspense fallback={<div className="mfa-page">جارٍ تجهيز التحقق الآمن...</div>}><MfaWorkspace /></Suspense></main>; }

"use client";

import { LogIn, Menu } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

import { ButtonLink, Drawer, IconButton } from "@/components/ui";

const links = [
  ["عن المؤسسة", "#about"],
  ["البرنامج", "#program"],
  ["تواصل معنا", "#contact"],
] as const;

export function PublicShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link className="brand-mark" href="/" aria-label="مواهب المنان"><span aria-hidden="true">م</span><strong>مواهب المنان</strong></Link>
        <nav aria-label="التنقل العام">{links.map(([label, href]) => <a key={label} href={href}>{label}</a>)}</nav>
        <ButtonLink href="/student" size="sm"><LogIn aria-hidden="true" size={18} />الدخول</ButtonLink>
        <span className="public-menu"><IconButton label="فتح القائمة" onClick={() => setOpen(true)}><Menu aria-hidden="true" /></IconButton></span>
      </header>
      <main id="main-content">{children}</main>
      <Drawer open={open} onOpenChange={setOpen} title="التنقل">
        <nav className="drawer-nav">{links.map(([label, href]) => <a key={label} href={href} onClick={() => setOpen(false)}>{label}</a>)}</nav>
        <ButtonLink href="/student">الدخول إلى المنصة</ButtonLink>
      </Drawer>
    </div>
  );
}

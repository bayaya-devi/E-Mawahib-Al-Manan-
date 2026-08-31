"use client";

import {
  BookOpenText,
  Activity,
  ChartNoAxesCombined,
  CircleUserRound,
  ClipboardCheck,
  GraduationCap,
  Home,
  LayoutDashboard,
  MessageSquareText,
  Search,
  Settings,
  ShieldCheck,
  Newspaper,
  Users,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Avatar, CommandPalette, ToastProvider } from "@/components/ui";
import { NotificationCenter } from "@/features/notifications";
import { OfflineProvider } from "@/features/offline";
import type { CommandItem } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

export type ShellKind = "student" | "family" | "teacher" | "admin";
type NavItem = { label: string; href: string; icon: LucideIcon };

const navigation: Record<ShellKind, NavItem[]> = {
  student: [
    { label: "الرئيسية", href: "/student", icon: Home },
    { label: "مسار الحفظ", href: "/student/quran", icon: BookOpenText },
    { label: "الواجبات", href: "/student/assignments", icon: ClipboardCheck },
    { label: "الرسائل", href: "/student/messages", icon: MessageSquareText },
    { label: "الإعدادات", href: "/student/settings", icon: Settings },
  ],
  family: [
    { label: "الرئيسية", href: "/family", icon: Home },
    { label: "المتابعة", href: "/family#follow-up", icon: ChartNoAxesCombined },
    { label: "الواجبات", href: "/family#assignments", icon: ClipboardCheck },
    { label: "الرسائل", href: "/family/messages", icon: MessageSquareText },
    { label: "الإعدادات", href: "/family/settings", icon: Settings },
  ],
  teacher: [
    { label: "الرئيسية", href: "/teacher", icon: Home },
    { label: "وضع الحصة", href: "/teacher/session", icon: BookOpenText },
    { label: "الطلاب", href: "/teacher/students", icon: UsersRound },
    { label: "المهني", href: "/teacher/professional", icon: ClipboardCheck },
    { label: "الرسائل", href: "/teacher/messages", icon: MessageSquareText },
    { label: "الإعدادات", href: "/teacher/settings", icon: Settings },
  ],
  admin: [
    { label: "القيادة", href: "/admin", icon: LayoutDashboard },
    { label: "الأشخاص", href: "/admin/people", icon: Users },
    { label: "الدراسة", href: "/admin/operations", icon: GraduationCap },
    { label: "الفريق", href: "/admin/workforce", icon: ClipboardCheck },
    { label: "الموارد", href: "/admin/resources", icon: WalletCards },
    { label: "التواصل", href: "/admin/communications", icon: Newspaper },
    { label: "الرقابة", href: "/admin/governance", icon: ShieldCheck },
    { label: "سلامة النظام", href: "/admin/system", icon: Activity },
  ],
};

const shellLabels: Record<ShellKind, { section: string; title: string }> = {
  student: { section: "مساحة الطالب", title: "متابعة التعلّم" },
  family: { section: "مساحة الأسرة", title: "متابعة الأبناء" },
  teacher: { section: "مساحة المعلّم", title: "إدارة التعلّم" },
  admin: { section: "مساحة الإدارة", title: "إدارة المؤسسة" },
};

export function AppShell({ kind, children }: { kind: ShellKind; children: ReactNode }) {
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = useState(false);
  const items = navigation[kind];
  const commands = useMemo<CommandItem[]>(() => items.map((item) => ({
    label: item.label,
    href: item.href,
    group: shellLabels[kind].section,
  })), [items, kind]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <ToastProvider><OfflineProvider>
      <div className={cn("app-shell", `app-shell--${kind}`)}>
        <aside className="app-rail" aria-label="التنقل الرئيسي">
          <Link className="brand-mark" href="/" aria-label="مواهب المنان">
            <span aria-hidden="true">م</span>
            <strong>مواهب المنان</strong>
          </Link>
          <nav className="app-rail__nav" aria-label="التنقل الرئيسي">
            {items.map((item) => <NavLink key={item.label} item={item} active={isActivePath(pathname, item.href)} />)}
          </nav>
          <a className="app-rail__profile" href={`/${kind}#profile`}>
            <Avatar name="حساب المستخدم" size="sm" />
            <span><strong>الحساب</strong><small>الملف الشخصي</small></span>
          </a>
        </aside>

        <div className="app-frame">
          <header className="app-header">
            <div>
              <span>{shellLabels[kind].section}</span>
              <strong>{shellLabels[kind].title}</strong>
            </div>
            <div className="app-header__actions">
              <button className="global-search-trigger" type="button" aria-label="فتح البحث العام" onClick={() => setCommandOpen(true)}>
                <Search aria-hidden="true" size={18} />
                <span>بحث</span><kbd>Ctrl K</kbd>
              </button>
              <NotificationCenter />
              <a className="mobile-profile" href={`/${kind}#profile`} aria-label="الملف الشخصي">
                <CircleUserRound aria-hidden="true" size={24} />
              </a>
            </div>
          </header>
          <main className="app-content" id="main-content">{children}</main>
        </div>

        <nav className="mobile-nav" aria-label="التنقل الرئيسي للهاتف">
          {items.map((item) => <NavLink key={item.label} item={item} active={isActivePath(pathname, item.href)} />)}
        </nav>
        <CommandPalette items={commands} open={commandOpen} onOpenChange={setCommandOpen} />
      </div>
    </OfflineProvider></ToastProvider>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link className={cn("app-nav-link", active && "is-active")} href={item.href} aria-current={active ? "page" : undefined}>
      <Icon aria-hidden="true" size={21} strokeWidth={active ? 2.4 : 1.8} />
      <span>{item.label}</span>
    </Link>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  const base = href.split("#")[0] ?? href;
  if (base === "/student" || base === "/family" || base === "/teacher" || base === "/admin") return pathname === base;
  return pathname === base || pathname.startsWith(`${base}/`);
}

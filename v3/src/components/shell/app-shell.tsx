"use client";

import {
  BookOpenText,
  ChartNoAxesCombined,
  CircleUserRound,
  ClipboardCheck,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Search,
  Gamepad2,
  Settings,
  Newspaper,
  UserCog,
  HeartHandshake,
  Landmark,
  RadioTower,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Avatar, CommandPalette, ToastProvider } from "@/components/ui";
import { NotificationCenter } from "@/features/notifications";
import { OfflineProvider } from "@/features/offline";
import { applyAppearance, watchSystemAppearance } from "@/features/settings/appearance";
import { rememberAuthenticatedAccount } from "@/features/teacher/device-account-vault";
import type { CommandItem } from "@/components/ui";
import { cn } from "@/lib/ui/cn";
import { createClient } from "@/lib/supabase/client";

export type ShellKind = "student" | "family" | "teacher" | "admin";
type NavItem = { label: string; href: string; icon: LucideIcon };

const navigation: Record<ShellKind, NavItem[]> = {
  student: [
    { label: "الرئيسية", href: "/student", icon: Home },
    { label: "السور", href: "/student/quran", icon: BookOpenText },
    { label: "الألعاب", href: "/student/games", icon: Gamepad2 },
    { label: "الوالدان", href: "/student/parents", icon: ClipboardCheck },
    { label: "ملفي", href: "/student/profile", icon: CircleUserRound },
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
    { label: "الطلاب", href: "/teacher/students", icon: UsersRound },
    { label: "بدء حصة", href: "/teacher/session", icon: BookOpenText },
    { label: "الرسائل", href: "/teacher/messages", icon: MessageSquareText },
    { label: "ملفي", href: "/teacher/professional", icon: ClipboardCheck },
    { label: "الإعدادات", href: "/teacher/settings", icon: Settings },
  ],
  admin: [
    { label: "الرئيسية", href: "/admin", icon: LayoutDashboard },
    { label: "الأساتذة", href: "/admin/teachers", icon: UserCog },
    { label: "الطلاب", href: "/admin/students", icon: GraduationCap },
    { label: "الوالدان", href: "/admin/parents", icon: HeartHandshake },
    { label: "المالية", href: "/admin/finance", icon: Landmark },
    { label: "التواصل", href: "/admin/communications", icon: MessageSquareText },
    { label: "المتابعة", href: "/admin/monitoring", icon: RadioTower },
    { label: "إدارة الموقع", href: "/admin/site", icon: Newspaper },
    { label: "الإعدادات", href: "/admin/settings", icon: Settings },
  ],
};

const shellLabels: Record<ShellKind, { section: string; title: string }> = {
  student: { section: "", title: "" },
  family: { section: "مساحة الأسرة", title: "متابعة الأبناء" },
  teacher: { section: "مساحة المعلّم", title: "إدارة التعلّم" },
  admin: { section: "", title: "إدارة المؤسسة" },
};

export function AppShell({ kind, children }: { kind: ShellKind; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(true);
  const items = navigation[kind];
  const commands = useMemo<CommandItem[]>(() => items.map((item) => ({
    label: item.label,
    href: item.href,
    group: shellLabels[kind].section,
  })), [items, kind]);

  useEffect(() => {
    applyAppearance();
    const mobileNavigationTimer = window.setTimeout(() => {
      if (window.matchMedia("(max-width: 720px)").matches) setNavigationOpen(false);
    }, 0);
    void rememberAuthenticatedAccount();
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", listener);
    const stopAppearanceWatch = watchSystemAppearance();
    return () => { window.clearTimeout(mobileNavigationTimer); window.removeEventListener("keydown", listener); stopAppearanceWatch(); };
  }, []);

  useEffect(() => {
    if (kind !== "teacher" && kind !== "student") return;
    void createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const profile = await createClient().from("profiles").select("display_name").eq("id", data.user.id).maybeSingle();
      if (kind === "teacher") setTeacherName(profile.data?.display_name ?? "");
      else setStudentName(profile.data?.display_name ?? "");
    });
  }, [kind]);

  async function signOut(): Promise<void> {
    setSigningOut(true);
    await createClient().auth.signOut({ scope: "local" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <ToastProvider><OfflineProvider>
      <div className={cn("app-shell", `app-shell--${kind}`, !navigationOpen && "is-navigation-collapsed")}>
        <aside className="app-rail" id="application-navigation" aria-label="التنقل الرئيسي">
          <Link className="brand-mark" href="/" aria-label="مواهب المنان">
            <span aria-hidden="true">م</span>
            <strong>مواهب المنان</strong>
          </Link>
          <button className="app-rail__collapse" type="button" aria-label={navigationOpen ? "طي قائمة التنقل" : "فتح قائمة التنقل"} aria-expanded={navigationOpen} onClick={() => setNavigationOpen((open) => !open)}><Menu aria-hidden="true" size={19} /></button>
          <nav className="app-rail__nav" aria-label="التنقل الرئيسي">
            {items.map((item) => <NavLink key={item.label} item={item} active={isActivePath(pathname, item.href)} />)}
          </nav>
          <a className="app-rail__profile" href={kind === "student" ? "/student/profile" : kind === "teacher" ? "/teacher/professional" : `/${kind}#profile`}>
            <Avatar name="حساب المستخدم" size="sm" />
            <span><strong>الحساب</strong><small>الملف الشخصي</small></span>
          </a>
        </aside>

        <div className="app-frame">
          <header className="app-header">
            {kind === "teacher" ? <div className="teacher-shell-identity"><strong>أستاذ(ة) {teacherName}</strong></div> : kind === "student" ? <div className="student-shell-identity"><strong>{studentName || "حساب الطالب"}</strong></div> : <div><span>{shellLabels[kind].section}</span><strong>{shellLabels[kind].title}</strong></div>}
            <div className="app-header__actions">
              <button className="navigation-toggle navigation-toggle--mobile" type="button" aria-label={navigationOpen ? "إخفاء قائمة التنقل" : "إظهار قائمة التنقل"} aria-expanded={navigationOpen} aria-controls="application-navigation mobile-navigation" onClick={() => setNavigationOpen((open) => !open)}>
                <Menu aria-hidden="true" size={20} />
              </button>
              {kind === "family" ? <button className="global-search-trigger" type="button" aria-label="فتح البحث العام" onClick={() => setCommandOpen(true)}>
                <Search aria-hidden="true" size={18} />
                <span>بحث</span><kbd>Ctrl K</kbd>
              </button> : <button className="teacher-signout" type="button" aria-label="تسجيل الخروج" disabled={signingOut} onClick={() => void signOut()}><LogOut aria-hidden="true" size={18} /><span>{signingOut ? "جار الخروج" : "تسجيل الخروج"}</span></button>}
              <NotificationCenter />
              <a className="mobile-profile" href={kind === "student" ? "/student/profile" : kind === "teacher" ? "/teacher/professional" : `/${kind}#profile`} aria-label="الملف الشخصي">
                <CircleUserRound aria-hidden="true" size={24} />
              </a>
            </div>
          </header>
          <main className="app-content" id="main-content">{children}</main>
        </div>

        <nav className="mobile-nav" id="mobile-navigation" aria-label="التنقل الرئيسي للهاتف">
          {items.map((item) => <NavLink key={item.label} item={item} active={isActivePath(pathname, item.href)} />)}
        </nav>
        {kind === "family" ? <CommandPalette items={commands} open={commandOpen} onOpenChange={setCommandOpen} /> : null}
      </div>
    </OfflineProvider></ToastProvider>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link className={cn("app-nav-link", active && "is-active")} href={item.href} aria-label={item.label} aria-current={active ? "page" : undefined}>
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

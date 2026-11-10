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
  MoreHorizontal,
  RadioTower,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Avatar, CommandPalette, Drawer, ToastProvider } from "@/components/ui";
import { NotificationCenter } from "@/features/notifications";
import { OfflineProvider } from "@/features/offline";
import { applyAppearance, readAppearance, watchSystemAppearance } from "@/features/settings/appearance";
import { rememberAuthenticatedAccount } from "@/features/teacher/device-account-vault";
import type { CommandItem } from "@/components/ui";
import { cn } from "@/lib/ui/cn";
import { getStudentStage, type StudentAgeCategory, type StudentStage } from "@/lib/ui/student-stage";
import { createClient } from "@/lib/supabase/client";
import { StudentLocaleProvider, type StudentLocale } from "@/features/learning/student-locale";

export type ShellKind = "student" | "family" | "teacher" | "admin";
type NavItem = { label: string; href: string; icon: LucideIcon };

const navigation: Record<ShellKind, NavItem[]> = {
  student: [
    { label: "الرئيسية", href: "/student", icon: Home },
    { label: "السور", href: "/student/quran", icon: BookOpenText },
    { label: "متابعة الحفظ", href: "/student/follow-up", icon: ChartNoAxesCombined },
    { label: "ملفي", href: "/student/profile", icon: CircleUserRound },
    { label: "الرسائل", href: "/student/messages", icon: MessageSquareText },
    { label: "الألعاب", href: "/student/games", icon: Gamepad2 },
    { label: "الوالدان", href: "/student/parents", icon: ClipboardCheck },
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
    { label: "الأقسام", href: "/admin/classes", icon: UsersRound },
    { label: "الوالدان", href: "/admin/parents", icon: HeartHandshake },
    { label: "المالية", href: "/admin/finance", icon: Landmark },
    { label: "التواصل", href: "/admin/communications", icon: MessageSquareText },
    { label: "المتابعة", href: "/admin/monitoring", icon: RadioTower },
    { label: "إدارة الموقع", href: "/admin/site", icon: Newspaper },
    { label: "الإعدادات", href: "/admin/settings", icon: Settings },
  ],
};

const studentNavigationFr: NavItem[] = [
  { label: "Accueil", href: "/student", icon: Home },
  { label: "Sourates", href: "/student/quran", icon: BookOpenText },
  { label: "Suivi", href: "/student/follow-up", icon: ChartNoAxesCombined },
  { label: "Mon dossier", href: "/student/profile", icon: CircleUserRound },
  { label: "Messages", href: "/student/messages", icon: MessageSquareText },
  { label: "Jeux", href: "/student/games", icon: Gamepad2 },
  { label: "Parents", href: "/student/parents", icon: ClipboardCheck },
  { label: "Paramètres", href: "/student/settings", icon: Settings },
];

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
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [studentStage, setStudentStage] = useState<StudentStage>("neutral");
  const [studentLocale, setStudentLocale] = useState<StudentLocale>("ar");
  const [studentProfiles, setStudentProfiles] = useState<Array<{ id: string; name: string; ageCategory: StudentAgeCategory | null; locale: StudentLocale }>>([]);
  const [activeStudent, setActiveStudent] = useState("");
  const items = kind === "student" && studentLocale === "fr" ? studentNavigationFr : navigation[kind];
  const isStudentFrench = kind === "student" && studentLocale === "fr";
  const interfaceLabels = isStudentFrench ? {
    mainNavigation: "Navigation principale",
    mobileNavigation: "Navigation principale sur mobile",
    more: "Plus",
    moreSections: "Autres rubriques",
    openMore: "Ouvrir les autres rubriques",
    profile: "Profil",
    account: "Compte",
    personalProfile: "Profil personnel",
    collapseNavigation: "Réduire la navigation",
    expandNavigation: "Déployer la navigation",
    signOut: "Se déconnecter",
    signingOut: "Déconnexion",
  } : {
    mainNavigation: "التنقل الرئيسي",
    mobileNavigation: "التنقل الرئيسي للهاتف",
    more: "المزيد",
    moreSections: "بقية الأقسام",
    openMore: "فتح بقية الأقسام",
    profile: "الملف الشخصي",
    account: "الحساب",
    personalProfile: "الملف الشخصي",
    collapseNavigation: "طي قائمة التنقل",
    expandNavigation: "فتح قائمة التنقل",
    signOut: "تسجيل الخروج",
    signingOut: "جار الخروج",
  };
  const mobileItemCount = kind === "student" ? 5 : 4;
  const mobileItems = items.slice(0, mobileItemCount);
  const secondaryItems = items.slice(mobileItemCount);
  const commands = useMemo<CommandItem[]>(() => items.map((item) => ({
    label: item.label,
    href: item.href,
    group: shellLabels[kind].section,
  })), [items, kind]);

  useEffect(() => {
    applyAppearance(readAppearance());
    void rememberAuthenticatedAccount();
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", listener);
    const stopAppearanceWatch = watchSystemAppearance();
    return () => { window.removeEventListener("keydown", listener); stopAppearanceWatch(); };
  }, [kind]);

  useEffect(() => {
    if (kind !== "teacher" && kind !== "student") return;
    if (kind === "student") {
      void fetch("/api/student/profile-switch", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) return;
        const value = await response.json() as { active: string; profiles: Array<{ id: string; name: string; ageCategory: StudentAgeCategory | null; locale: StudentLocale }> };
        const selected = value.profiles.find((profile) => profile.id === value.active) ?? value.profiles[0];
        setStudentProfiles(value.profiles); setActiveStudent(selected?.id ?? ""); setStudentName(selected?.name ?? ""); setStudentStage(getStudentStage(selected?.ageCategory ?? null)); setStudentLocale(selected?.locale ?? "ar");
      }).catch(() => undefined);
      return;
    }
    const client = createClient();
    void client.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const profile = await client.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle();
      setTeacherName(profile.data?.display_name ?? "");
    });
  }, [kind]);

  async function switchStudent(studentId: string): Promise<void> {
    if (!studentId || studentId === activeStudent) return;
    const response = await fetch("/api/student/profile-switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId }) });
    if (!response.ok) return;
    const selected = studentProfiles.find((profile) => profile.id === studentId);
    setActiveStudent(studentId); setStudentName(selected?.name ?? ""); setStudentStage(getStudentStage(selected?.ageCategory ?? null)); setStudentLocale(selected?.locale ?? "ar"); router.refresh();
  }

  async function switchStudentLocale(locale: StudentLocale): Promise<void> {
    if (!activeStudent || locale === studentLocale) return;
    const response = await fetch("/api/student/profile-switch", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: activeStudent, locale }) });
    if (!response.ok) return;
    setStudentLocale(locale);
    setStudentProfiles((profiles) => profiles.map((profile) => profile.id === activeStudent ? { ...profile, locale } : profile));
    router.refresh();
  }

  async function signOut(): Promise<void> {
    setSigningOut(true);
    await createClient().auth.signOut({ scope: "local" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <ToastProvider><OfflineProvider>
      <StudentLocaleProvider locale={studentLocale}><div className={cn("app-shell", `app-shell--${kind}`, !navigationOpen && "is-navigation-collapsed")} data-student-stage={kind === "student" ? studentStage : undefined} lang={kind === "student" ? studentLocale : "ar"} dir={kind === "student" && studentLocale === "fr" ? "ltr" : "rtl"}>
        <aside className="app-rail" id="application-navigation" aria-label={interfaceLabels.mainNavigation}>
          <Link className="brand-mark" href="/" aria-label="مواهب المنان">
            <Image src="/dar-al-hadith/logo.webp" alt="" width={44} height={43} priority />
            <strong>مواهب المنان</strong>
          </Link>
          <button className="app-rail__collapse" type="button" aria-label={navigationOpen ? interfaceLabels.collapseNavigation : interfaceLabels.expandNavigation} aria-expanded={navigationOpen} onClick={() => setNavigationOpen((open) => !open)}><Menu aria-hidden="true" size={19} /></button>
          <nav className="app-rail__nav" aria-label={interfaceLabels.mainNavigation}>
            {items.map((item) => <NavLink key={item.label} item={item} active={isActivePath(pathname, item.href)} />)}
          </nav>
          <Link className="app-rail__profile" prefetch={false} href={kind === "student" ? "/student/profile" : kind === "teacher" ? "/teacher/professional" : `/${kind}#profile`}>
            <Avatar name={interfaceLabels.account} size="sm" />
            <span><strong>{interfaceLabels.account}</strong><small>{interfaceLabels.personalProfile}</small></span>
          </Link>
        </aside>

        <div className="app-frame">
          <header className="app-header">
            {kind === "teacher" ? <div className="teacher-shell-identity"><strong>أستاذ(ة) {teacherName}</strong></div> : kind === "student" ? <div className="student-shell-identity"><strong>{studentName || (studentLocale === "fr" ? "Compte élève" : "حساب الطالب")}</strong>{studentProfiles.length > 1 ? <select aria-label={studentLocale === "fr" ? "Changer de profil élève" : "تغيير ملف الطالب"} value={activeStudent} onChange={(event) => void switchStudent(event.target.value)}>{studentProfiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select> : null}<select aria-label={studentLocale === "fr" ? "Langue" : "اللغة"} value={studentLocale} onChange={(event) => void switchStudentLocale(event.target.value as StudentLocale)}><option value="ar">العربية</option><option value="fr">Français</option></select></div> : <div><span>{shellLabels[kind].section}</span><strong>{shellLabels[kind].title}</strong></div>}
            <div className="app-header__actions">
              <button className="navigation-toggle navigation-toggle--mobile" type="button" aria-label={interfaceLabels.openMore} aria-expanded={mobileMoreOpen} aria-controls="mobile-more-navigation" onClick={() => setMobileMoreOpen(true)}>
                <Menu aria-hidden="true" size={20} />
              </button>
              {kind === "family" ? <button className="global-search-trigger" type="button" aria-label="فتح البحث العام" onClick={() => setCommandOpen(true)}>
                <Search aria-hidden="true" size={18} />
                <span>بحث</span><kbd>Ctrl K</kbd>
              </button> : <button className="teacher-signout" type="button" aria-label={interfaceLabels.signOut} disabled={signingOut} onClick={() => void signOut()}><LogOut aria-hidden="true" size={18} /><span>{signingOut ? interfaceLabels.signingOut : interfaceLabels.signOut}</span></button>}
              <NotificationCenter />
              <Link className="mobile-profile" prefetch={false} href={kind === "student" ? "/student/profile" : kind === "teacher" ? "/teacher/professional" : `/${kind}#profile`} aria-label={interfaceLabels.profile}>
                <CircleUserRound aria-hidden="true" size={24} />
              </Link>
            </div>
          </header>
          <main className="app-content" id="main-content">{children}</main>
        </div>

        <nav className="mobile-nav" id="mobile-navigation" aria-label={interfaceLabels.mobileNavigation}>
          {mobileItems.map((item) => <NavLink key={item.label} item={item} active={isActivePath(pathname, item.href)} />)}
          {kind === "student" ? null : <button className={cn("app-nav-link", "mobile-nav__more", secondaryItems.some((item) => isActivePath(pathname, item.href)) && "is-active")} type="button" aria-label={interfaceLabels.more} aria-expanded={mobileMoreOpen} onClick={() => setMobileMoreOpen(true)}><MoreHorizontal aria-hidden="true" size={21} /><span>{interfaceLabels.more}</span></button>}
        </nav>
        <Drawer open={mobileMoreOpen} onOpenChange={setMobileMoreOpen} title={interfaceLabels.moreSections}>
          <nav className="mobile-more-nav" id="mobile-more-navigation" aria-label={interfaceLabels.moreSections}>
            {secondaryItems.map((item) => <NavLink key={item.label} item={item} active={isActivePath(pathname, item.href)} onNavigate={() => setMobileMoreOpen(false)} />)}
          </nav>
        </Drawer>
        {kind === "family" ? <CommandPalette items={commands} open={commandOpen} onOpenChange={setCommandOpen} /> : null}
      </div></StudentLocaleProvider>
    </OfflineProvider></ToastProvider>
  );
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link className={cn("app-nav-link", active && "is-active")} href={item.href} prefetch={false} aria-label={item.label} aria-current={active ? "page" : undefined} title={item.label} {...(onNavigate ? { onClick: onNavigate } : {})}>
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

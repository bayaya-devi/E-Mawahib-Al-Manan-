// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { AppShell } from "@/components/shell/app-shell";
import { QuranCatalog } from "@/features/quran/quran-catalog";
import { ParentSurvey, StudentGames, StudentProfile } from "./student-extensions";
import { StudentDashboard } from "./student-dashboard";
import type { StudentDashboardData } from "./models";

const replace = vi.fn();
const rpc = vi.fn().mockResolvedValue({ error: null });
vi.mock("next/navigation", () => ({ usePathname: () => "/student", useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/features/notifications", () => ({ NotificationCenter: () => null }));
vi.mock("@/features/offline", () => ({ OfflineProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }), getSession: vi.fn().mockResolvedValue({ data: { session: null } }), signOut: vi.fn().mockResolvedValue({}) }, rpc }) }));

afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

describe("student stabilization", () => {
  it("collapses and restores the six-item navigation with one logout", () => {
    render(<AppShell kind="student"><p>محتوى</p></AppShell>);
    expect(screen.getAllByRole("link", { name: /الرئيسية|السور|الألعاب|الوالدان|ملفي|الإعدادات/ })).toHaveLength(12);
    expect(screen.getAllByRole("button", { name: "تسجيل الخروج" })).toHaveLength(1);
    const toggle = screen.getByRole("button", { name: "إخفاء قائمة التنقل" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("shows only teacher, class, schedule, active assignment and progress", () => {
    const data: StudentDashboardData = { student: { id: "s", name: "سليم" }, teacher: { id: "t", name: "محمد" }, classroom: { id: "c", name: "القسم الأول" }, nextCourse: { id: "x", title: "حصة", startsAt: "2026-09-07T18:00:00Z", endsAt: "2026-09-07T20:00:00Z", location: null }, courseSchedule: [{ id: "x", startsAt: "2026-09-07T18:00:00Z", endsAt: "2026-09-07T20:00:00Z" }], assignments: [{ id: "a", title: "واجب", instructions: "راجع جيداً", dueAt: "2026-09-08T00:00:00Z", surahNumber: 114, verseFrom: 1, verseTo: 6, status: "todo" }], announcements: [], events: [], goal: null, progress: [], notifications: [] };
    render(<StudentDashboard data={data} />);
    expect(screen.getByText("محمد")).toBeVisible(); expect(screen.getByText("القسم الأول")).toBeVisible(); expect(screen.getByText("أوقات الحصص")).toBeVisible(); expect(screen.getAllByText("سُورَةُ النَّاسِ").length).toBeGreaterThan(0);
    expect(screen.queryByText("التنبيهات")).not.toBeInTheDocument(); expect(screen.queryByText("السورة التالية")).not.toBeInTheDocument();
  });

  it("renders completed, current and one preview juz only", () => {
    const progress = Array.from({ length: 37 }, (_, index) => ({ surahNumber: 114 - index, status: "mastered" as const, percent: 100, stars: 4 }));
    render(<QuranCatalog progress={progress} />);
    expect(screen.getByText("جزء عمّ")).toBeVisible(); expect(screen.getByText("جزء تبارك")).toBeVisible(); expect(screen.getByText("جزء قد سمع")).toBeVisible(); expect(screen.queryByText("جزء قال فما خطبكم")).not.toBeInTheDocument();
    expect(screen.getAllByText("أتم الجزء الحالي أولاً")).toHaveLength(1);
  });

  it("keeps one score per parent criterion and submits the backend mutation", async () => {
    render(<ToastProvider><ParentSurvey /></ToastProvider>);
    expect(screen.getByText(/تعني 1 «ضعيف» وتعني 10 «ممتاز»/)).toBeVisible();
    const sevens = screen.getAllByRole("button", { name: /: 7$/ }); const nines = screen.getAllByRole("button", { name: /: 9$/ });
    fireEvent.click(sevens[0]!); fireEvent.click(nines[0]!);
    expect(sevens[0]).toHaveAttribute("aria-pressed", "false"); expect(nines[0]).toHaveAttribute("aria-pressed", "true");
    for (let index = 1; index < nines.length; index += 1) fireEvent.click(nines[index]!);
    fireEvent.click(screen.getByRole("button", { name: "إرسال" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("submit_parent_feedback", { target_scores: [9, 9, 9, 9, 9], target_comment: null }));
  });

  it("opens three real games through juz and surah selection", () => {
    render(<StudentGames unlocked={[114]} />);
    expect(screen.getByRole("button", { name: /رتّب الآيات/ })).toBeVisible(); expect(screen.getByRole("button", { name: /لغز المقطع/ })).toBeVisible(); expect(screen.getByRole("button", { name: /أكمل المقطع/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /رتّب الآيات/ })); fireEvent.click(screen.getByRole("button", { name: "جزء عمّ" })); fireEvent.click(screen.getByRole("button", { name: /سُورَةُ النَّاسِ/ })); fireEvent.click(screen.getByRole("button", { name: "ابدأ اللعبة" }));
    expect(screen.getByText("رتّب آيات المقطع")).toBeVisible();
  });

  it("shows unpaid months until a real payment is supplied", () => {
    render(<StudentProfile name="سليم" dateOfBirth={null} className="القسم الأول" documents={[]} file={{ birth: true, guardian: true, identity: false, paymentRequired: true, fee: 100, payments: [] }} />);
    expect(screen.getByRole("heading", { name: "الواجبات" })).toBeVisible(); expect(screen.getAllByText("غير مؤدى")).toHaveLength(10);
  });
});

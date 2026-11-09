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

afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("student stabilization", () => {
  it("keeps the five requested student destinations visible and secondary destinations in the menu", () => {
    render(<AppShell kind="student"><p>محتوى</p></AppShell>);
    expect(screen.getAllByRole("link", { name: "الرئيسية" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "السور" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "متابعة الحفظ" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "ملفي" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "الرسائل" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "تسجيل الخروج" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "فتح بقية الأقسام" }));
    expect(screen.getAllByRole("link", { name: /الألعاب|الوالدان|الإعدادات/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    const toggle = screen.getByRole("button", { name: "طي قائمة التنقل" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("shows only teacher, class, schedule, active assignment and progress", () => {
    const data: StudentDashboardData = { student: { id: "s", name: "سليم" }, teacher: { id: "t", name: "محمد" }, classroom: { id: "c", name: "القسم الأول" }, classScheduleText: "الثلاثاء والخميس: 18:00–20:00", nextCourse: { id: "x", title: "حصة", startsAt: "2026-09-07T18:00:00Z", endsAt: "2026-09-07T20:00:00Z", location: null }, courseSchedule: [{ id: "x", startsAt: "2026-09-07T18:00:00Z", endsAt: "2026-09-07T20:00:00Z" }], assignments: [{ id: "a", title: "واجب", instructions: "راجع جيداً", dueAt: "2026-09-08T00:00:00Z", surahNumber: 114, verseFrom: 1, verseTo: 6, status: "todo" }], announcements: [], events: [], goal: null, progress: [], juzExams: [], notifications: [] };
    render(<StudentDashboard data={data} />);
    expect(screen.getByText("محمد")).toBeVisible(); expect(screen.getByText("القسم الأول")).toBeVisible(); expect(screen.getByText("الثلاثاء والخميس: 18:00–20:00")).toBeVisible(); expect(screen.getByText("أوقات الحصص")).toBeVisible(); expect(screen.getAllByText("سُورَةُ النَّاسِ").length).toBeGreaterThan(0);
    expect(screen.queryByText("التنبيهات")).not.toBeInTheDocument(); expect(screen.queryByText("السورة التالية")).not.toBeInTheDocument();
  }, 10_000);

  it("renders completed, current and one preview juz only", () => {
    const progress = Array.from({ length: 48 }, (_, index) => ({ surahNumber: 114 - index, status: "mastered" as const, percent: 100, stars: 4 }));
    render(<QuranCatalog progress={progress} juzExams={[{ juzNumber: 30, score: 90, passed: true, completedAt: "2026-09-01T10:00:00Z" }]} />);
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
    expect(screen.getByRole("button", { name: /الترتيب السريع/ })).toBeVisible(); expect(screen.getByRole("button", { name: /ألغاز القرآن/ })).toBeVisible(); expect(screen.getByRole("button", { name: /المقطع الغامض/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /الترتيب السريع/ })); fireEvent.click(screen.getByRole("button", { name: "جزء عمّ" })); fireEvent.click(screen.getByRole("button", { name: /سُورَةُ النَّاسِ/ })); fireEvent.click(screen.getByRole("button", { name: "ابدأ اللعبة" }));
    expect(screen.getByText("رتّب آيات المقطع")).toBeVisible();
  });

  it("shows unpaid months until a real payment is supplied", () => {
    render(<StudentProfile name="سليم" dateOfBirth={null} className="القسم الأول" documents={[]} file={{ birth: true, guardian: true, identity: false, paymentRequired: true, fee: 100, payments: [] }} />);
    expect(screen.getByRole("heading", { name: "الواجبات" })).toBeVisible(); expect(screen.getAllByText("غير مؤدى")).toHaveLength(10);
  });

  it("keeps a September payment on September regardless of the device timezone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 13, 12, 0, 0));
    render(<StudentProfile name="سليم" dateOfBirth={null} className="القسم الأول" documents={[]} file={{ birth: true, guardian: true, identity: false, paymentRequired: true, fee: 100, payments: [{ month: "2026-09", amount: 100, expectedAmount: 100, date: "2026-09-13", status: "paid" }] }} />);
    const september = screen.getByText("شتنبر").closest("details");
    expect(september).toHaveClass("is-paid");
  });

  it("does not present a partial payment as paid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 13, 12, 0, 0));
    render(<StudentProfile name="سليم" dateOfBirth={null} className="القسم الأول" documents={[]} file={{ birth: true, guardian: true, identity: false, paymentRequired: true, fee: 100, payments: [{ month: "2026-09", amount: 40, expectedAmount: 100, date: "2026-09-13", status: "partial" }] }} />);
    const september = screen.getByText("شتنبر").closest("details");
    expect(september).toHaveClass("is-partial");
    expect(september).not.toHaveClass("is-paid");
    expect(screen.getByText("مؤدى جزئياً")).toBeVisible();
  });
});

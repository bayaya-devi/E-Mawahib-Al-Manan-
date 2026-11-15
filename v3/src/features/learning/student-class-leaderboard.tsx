"use client";

import { Star, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import { Dialog } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

import { studentText, useStudentLocale } from "./student-locale";

type LeaderboardEntry = {
  class_id: string;
  class_name: string;
  names_visible: boolean;
  student_id: string;
  display_name: string | null;
  total_stars: number;
  class_rank: number;
};

type LoadState =
  | { status: "idle" | "loading" }
  | { status: "ready"; entries: LeaderboardEntry[] }
  | { status: "error" };

export function StudentClassLeaderboard({ studentId }: { studentId: string | null }) {
  const locale = useStudentLocale();
  const t = (ar: string, fr: string) => studentText(locale, ar, fr);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    if (!open || !studentId) return;
    let active = true;

    void (async () => {
      try {
        const { data, error } = await createClient().rpc("get_student_class_leaderboard", { target_student: studentId });
        if (!active) return;
        if (error) {
          setState({ status: "error" });
          return;
        }
        setState({ status: "ready", entries: data ?? [] });
      } catch {
        if (active) setState({ status: "error" });
      }
    })();

    return () => { active = false; };
  }, [open, studentId]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setState({ status: "loading" });
  }

  if (!studentId) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      closeLabel={t("إغلاق", "Fermer")}
      title={t("ترتيب القسم", "Classement de la classe")}
      description={state.status === "ready" && state.entries[0]
        ? state.entries[0].class_name
        : t("ترتيب النجوم داخل قسمك", "Classement des étoiles de votre classe")}
      trigger={<button className="student-class-ranking-trigger" type="button"><Trophy aria-hidden="true" size={17} /><span>{t("ترتيب القسم", "Classement")}</span></button>}
    >
      <div className="student-class-ranking" aria-live="polite">
        {state.status === "loading" || state.status === "idle" ? <p className="student-class-ranking__state">{t("جار تحميل الترتيب…", "Chargement du classement…")}</p> : null}
        {state.status === "error" ? <p className="student-class-ranking__state" role="alert">{t("تعذر تحميل الترتيب. أعد المحاولة لاحقاً.", "Le classement est indisponible. Réessayez plus tard.")}</p> : null}
        {state.status === "ready" && state.entries.length === 0 ? <p className="student-class-ranking__state">{t("لا يوجد ترتيب متاح حالياً.", "Aucun classement n’est disponible pour le moment.")}</p> : null}
        {state.status === "ready" && state.entries.length > 0 ? <ol className="student-class-ranking__list">{state.entries.map((entry, index) => {
          const current = entry.student_id === studentId;
          const label = current ? t("أنت", "Vous") : entry.display_name ?? t(`طالب ${index + 1}`, `Élève ${index + 1}`);
          return <li className={current ? "is-current" : undefined} key={entry.student_id}>
            <span className={entry.class_rank <= 3 ? "student-class-ranking__rank is-podium" : "student-class-ranking__rank"}>{entry.class_rank}</span>
            <strong>{label}</strong>
            <span className="student-class-ranking__stars"><Star aria-hidden="true" size={16} fill="currentColor" />{entry.total_stars}</span>
          </li>;
        })}</ol> : null}
      </div>
    </Dialog>
  );
}

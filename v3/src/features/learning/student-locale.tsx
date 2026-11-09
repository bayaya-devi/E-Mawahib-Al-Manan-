"use client";

import { createContext, useContext, type ReactNode } from "react";

export type StudentLocale = "ar" | "fr";

const StudentLocaleContext = createContext<StudentLocale>("ar");

export function StudentLocaleProvider({ locale, children }: { locale: StudentLocale; children: ReactNode }) {
  return <StudentLocaleContext.Provider value={locale}>{children}</StudentLocaleContext.Provider>;
}

export function useStudentLocale(): StudentLocale {
  return useContext(StudentLocaleContext);
}

export function studentText(locale: StudentLocale, ar: string, fr: string): string {
  return locale === "fr" ? fr : ar;
}

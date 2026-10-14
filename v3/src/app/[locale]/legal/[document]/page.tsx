import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/shell";
import { isPublicLocale, type PublicLocale } from "@/features/public-site/content";
import { legalDocuments, legalTitles, type LegalDocument } from "@/features/privacy/legal-content";

type Props = { params: Promise<{ locale: string; document: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { locale, document } = await params; if (!isPublicLocale(locale) || !(document in legalTitles)) return {}; return { title: legalTitles[document as LegalDocument][locale === "amz" ? "fr" : locale] }; }
export default async function LegalPage({ params }: Props) { const { locale: rawLocale, document } = await params; if (!isPublicLocale(rawLocale) || !(document in legalDocuments)) notFound(); const locale = rawLocale as PublicLocale; const language = locale === "amz" ? "fr" : locale; const content = legalDocuments[document as LegalDocument][language]; return <PublicShell locale={locale}><article className="public-page legal-page"><header className="public-page__intro"><span>TODO-JURISTE</span><h1>{legalTitles[document as LegalDocument][language]}</h1><p>{content.intro}</p></header>{content.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}</article></PublicShell>; }

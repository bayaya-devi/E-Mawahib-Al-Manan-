import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "مواهب المنان",
    template: "%s | مواهب المنان",
  },
  description: "منصة مواهب المنان للتعلّم والمتابعة والإدارة",
};

type RootLayoutProps = Readonly<{ children: ReactNode }>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          انتقل إلى المحتوى
        </a>
        {children}
      </body>
    </html>
  );
}

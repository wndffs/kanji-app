import type { Metadata } from "next";
import type { ReactNode } from "react";

import { APP_NAME } from "@kanji-srs/shared";

import { AppShell } from "../components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Personal Russian-first Japanese kanji and vocabulary SRS with Russian and English learning translations.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

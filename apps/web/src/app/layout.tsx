import type { Metadata } from "next";
import type { ReactNode } from "react";

import { APP_NAME } from "@kanji-srs/shared";

import { AppShell } from "../components/AppShell";
import { InterfacePreferencesSync } from "../components/InterfacePreferencesSync";
import { OfflineShellRegistration } from "../components/OfflineShellRegistration";
import { INTERFACE_PREFERENCES_BOOTSTRAP } from "../lib/interface-preferences";
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
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTERFACE_PREFERENCES_BOOTSTRAP }} />
      </head>
      <body>
        <InterfacePreferencesSync />
        <OfflineShellRegistration />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

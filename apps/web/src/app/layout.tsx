import type { Metadata } from "next";
import type { ReactNode } from "react";

import { APP_NAME } from "@kanji-srs/shared";

import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Personal Russian-localized Japanese kanji and vocabulary SRS.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

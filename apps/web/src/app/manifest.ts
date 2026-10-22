import type { MetadataRoute } from "next";

import { APP_NAME } from "@kanji-srs/shared";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Кандзи, слова и отдельные уроки хираганы и катаканы.",
    lang: "ru",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6f3",
    theme_color: "#2364aa",
    prefer_related_applications: false,
    icons: [192, 512].flatMap((size) =>
      (["any", "maskable"] as const).map((purpose) => ({
        src: `/icons/app-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose,
      })),
    ),
  };
}

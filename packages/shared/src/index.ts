export const APP_NAME = "Кандзи SRS";
export const APP_LOCALE = "ru-RU";
export const WORKSPACE_STATUS = "Готово";

export type WorkspacePackageName =
  | "@kanji-srs/db"
  | "@kanji-srs/srs"
  | "@kanji-srs/japanese"
  | "@kanji-srs/content-importers"
  | "@kanji-srs/shared"
  | "@kanji-srs/ui";

export type WorkspacePackageInfo = {
  name: WorkspacePackageName;
  responsibility: string;
};

export const workspacePackages: WorkspacePackageInfo[] = [
  { name: "@kanji-srs/db", responsibility: "database schema and client ownership" },
  { name: "@kanji-srs/srs", responsibility: "framework-agnostic scheduling logic" },
  { name: "@kanji-srs/japanese", responsibility: "Japanese and Russian answer helpers" },
  { name: "@kanji-srs/content-importers", responsibility: "open-data import pipelines" },
  { name: "@kanji-srs/shared", responsibility: "serializable shared contracts" },
  { name: "@kanji-srs/ui", responsibility: "reusable web UI components" },
];

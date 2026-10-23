export type NavigationItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
};

export const primaryNavigation = [
  { href: "/dashboard", label: "Панель" },
  { href: "/lessons", label: "Уроки" },
  { href: "/reviews", label: "Повторения" },
  { href: "/practice", label: "Практика" },
  { href: "/characters", label: "Символы" },
  { href: "/search", label: "Поиск" },
  { href: "/decks", label: "Колоды" },
  { href: "/settings", label: "Настройки" },
  { href: "/admin", label: "Админ", adminOnly: true },
] satisfies NavigationItem[];

const mainPaths = new Set(["/dashboard", "/lessons", "/reviews", "/characters", "/search"]);
export const mainNavigation = primaryNavigation.filter((item) => mainPaths.has(item.href));
export const secondaryNavigation: readonly NavigationItem[] = [
  { href: "/courses", label: "Курсы" },
  ...primaryNavigation.filter((item) => !mainPaths.has(item.href)),
];

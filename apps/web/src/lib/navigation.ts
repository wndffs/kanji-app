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
  { href: "/kana", label: "Кана" },
  { href: "/search", label: "Поиск" },
  { href: "/decks", label: "Колоды" },
  { href: "/settings", label: "Настройки" },
  { href: "/admin", label: "Админ", adminOnly: true },
] satisfies NavigationItem[];

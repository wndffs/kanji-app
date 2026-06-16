export type NavigationItem = {
  href: string;
  label: string;
};

export const primaryNavigation = [
  { href: "/", label: "Панель" },
  { href: "/lessons", label: "Уроки" },
  { href: "/reviews", label: "Повторения" },
  { href: "/search", label: "Поиск" },
  { href: "/decks", label: "Колоды" },
  { href: "/settings", label: "Настройки" },
] satisfies NavigationItem[];

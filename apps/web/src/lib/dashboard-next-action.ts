export function dashboardNextAction(input: {
  readonly dueReviews: number;
  readonly availableLessons: number;
  readonly hasCourse: boolean;
  readonly vacationActive: boolean;
}) {
  if (input.vacationActive) return { href: "/settings", label: "Настроить отпуск", title: "Расписание на паузе" };
  if (input.dueReviews > 0) return { href: "/reviews", label: "Повторять", title: `К повторению: ${input.dueReviews}` };
  if (input.availableLessons > 0) return { href: "/lessons", label: "Учить", title: `Новых материалов: ${input.availableLessons}` };
  if (!input.hasCourse) return { href: "/courses", label: "Выбрать курс", title: "Начните с курса" };
  return { href: "/practice", label: "Практика", title: "Сейчас нет новых заданий" };
}

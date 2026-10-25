import {
  DEFAULT_DASHBOARD_WIDGET_PREFERENCES,
  type DashboardWidgetId,
  type DashboardWidgetPreferenceDto,
} from "@kanji-srs/shared";

const DAILY_ORDER: readonly DashboardWidgetId[] = [
  "summary",
  "course-progress",
  "review-forecast",
  "workload",
  "study-activity",
  "srs-stage-spread",
  "recent-activity",
  "leech-candidates",
  "recent-review-stats",
];

// Recompose only the untouched legacy default; explicit personal layouts keep their order.
export function presentDashboardWidgets(
  preferences: readonly DashboardWidgetPreferenceDto[],
): readonly DashboardWidgetPreferenceDto[] {
  const isDefault =
    preferences.length === DEFAULT_DASHBOARD_WIDGET_PREFERENCES.length &&
    preferences.every((item, index) => {
      const original = DEFAULT_DASHBOARD_WIDGET_PREFERENCES[index];
      return (
        item.id === original?.id &&
        item.visible === original.visible &&
        item.presentation === original.presentation
      );
    });
  if (!isDefault) return preferences;
  return DAILY_ORDER.map((id) => ({
    id,
    visible: true,
    presentation: id === "summary" ? "expanded" : "compact",
  }));
}

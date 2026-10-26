import { expect, it, vi } from "vitest";
import { DashboardController } from "../src/dashboard/dashboard.controller";
import { type DashboardService } from "../src/dashboard/dashboard.service";
import { type CurrentUserDto } from "../src/auth/auth.types";

it("returns numeric dashboard phases without exposing user data in timing headers", async () => {
  const data = { user: { id: "private-owner" } };
  const service = { getDashboard: vi.fn(async (_user, record) => {
    record("primary", 31.25);
    record("hydrate", 8);
    return data;
  }) };
  const response = { setHeader: vi.fn() };
  const result = await new DashboardController(service as unknown as DashboardService).getDashboard(
    { id: "private-owner" } as CurrentUserDto, { authDurationMs: 12.4 }, response,
  );
  expect(result).toBe(data);
  const [name, value] = response.setHeader.mock.calls[0]!;
  expect(name).toBe("Server-Timing");
  expect(value).toMatch(/^auth;dur=12\.4, primary;dur=31\.3, hydrate;dur=8\.0, dashboard;dur=\d+\.\d$/);
  expect(value).not.toContain("private-owner");
});

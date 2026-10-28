import { expect, it, vi } from "vitest";
import { timedQueueRead } from "../src/http/queue-timing";

it.each(["lessons", "reviews"] as const)(
  "reports only numeric %s handler/auth durations",
  async (phase) => {
    const data = { privateOwner: "not-in-headers" };
    const response = { setHeader: vi.fn() };
    expect(await timedQueueRead(phase, async () => data, response, Number.NaN)).toBe(data);
    const [name, header] = response.setHeader.mock.calls[0]!;
    expect(name).toBe("Server-Timing");
    expect(header).toMatch(new RegExp(`^auth;dur=0\\.0, ${phase};dur=\\d+\\.\\d$`));
    expect(header).not.toContain("not-in-headers");
  },
);
it("propagates failure without a success timing or replay", async () => {
  const read = vi.fn().mockRejectedValue(new Error("unavailable"));
  const response = { setHeader: vi.fn() };
  await expect(timedQueueRead("lessons", read, response)).rejects.toThrow("unavailable");
  expect(read).toHaveBeenCalledTimes(1);
  expect(response.setHeader).not.toHaveBeenCalled();
});

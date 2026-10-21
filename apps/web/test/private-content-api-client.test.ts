import { afterEach, describe, expect, it, vi } from "vitest";
import { getPrivateMnemonics, replacePrivateAcceptedAnswer } from "../src/lib/api-client";

afterEach(() => vi.unstubAllGlobals());

describe("private content API client", () => {
  it("replaces a synonym with one PUT, never DELETE then POST", async () => {
    const response = { id: "override/one", text: "new answer" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response)));
    vi.stubGlobal("fetch", fetchMock);
    const input = { answerKind: "meaning" as const, locale: "en-US" as const, text: "new answer" };
    await expect(
      replacePrivateAcceptedAnswer("token", "card/one", "override/one", input),
    ).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:3001/cards/card%2Fone/overrides/override%2Fone");
    expect(request.method).toBe("PUT");
    expect(JSON.parse(request.body)).toEqual(input);
    expect(request.headers.get("Authorization")).toBe("Bearer token");
  });

  it("reads typed private notes using authenticated GET", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getPrivateMnemonics("token", "item/one")).resolves.toEqual([]);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:3001/items/item%2Fone/private-mnemonics");
    expect(request.method).toBe("GET");
    expect(request.headers.get("Authorization")).toBe("Bearer token");
  });
});

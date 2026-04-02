import { fetchNamedBoard } from "@/lib/api";

describe("API 401 auto-clear", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    window.localStorage.setItem("pm-token", "old-token");
    window.localStorage.setItem("pm-username", "olduser");

    // Mock window.location.reload
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, reload: vi.fn() },
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  it("clears localStorage and reloads on 401 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(fetchNamedBoard("user", 1, "bad-token")).rejects.toThrow();

    expect(window.localStorage.getItem("pm-token")).toBeNull();
    expect(window.localStorage.getItem("pm-username")).toBeNull();
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("does not clear localStorage on non-401 errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Not Found" } }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(fetchNamedBoard("user", 1, "token")).rejects.toThrow();

    expect(window.localStorage.getItem("pm-token")).toBe("old-token");
    expect(window.localStorage.getItem("pm-username")).toBe("olduser");
  });
});

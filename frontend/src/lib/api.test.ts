import { fetchBoard, saveBoard } from "@/lib/api";
import { initialData } from "@/lib/kanban";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("board API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchBoard returns board payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ username: "user", board: initialData })
    );

    const board = await fetchBoard("user");

    expect(board).toEqual(initialData);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/users/user/board", {
      cache: "no-store",
    });
  });

  it("saveBoard sends put request and returns saved board", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ username: "user", board: initialData })
    );

    const board = await saveBoard("user", initialData);

    expect(board).toEqual(initialData);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/users/user/board", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initialData),
    });
  });

  it("throws parsed API error messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed.",
          },
        },
        422
      )
    );

    await expect(fetchBoard("user")).rejects.toThrow(
      "Request validation failed."
    );
  });
});

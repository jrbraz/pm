import { fetchBoard, saveBoard, sendChat } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

const testBoard: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Task", details: "Details" },
  },
};

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
      jsonResponse({ username: "user", board: testBoard })
    );

    const board = await fetchBoard("user");

    expect(board).toEqual(testBoard);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/users/user/board", {
      cache: "no-store",
    });
  });

  it("saveBoard sends put request and returns saved board", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ username: "user", board: testBoard })
    );

    const board = await saveBoard("user", testBoard);

    expect(board).toEqual(testBoard);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/users/user/board", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testBoard),
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

describe("chat API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sendChat posts message and returns response", async () => {
    const chatResponse = { reply: "Hello!", board_updated: false };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(chatResponse)
    );

    const result = await sendChat("user", "hi", []);

    expect(result).toEqual(chatResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/users/user/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi", history: [] }),
    });
  });

  it("sendChat includes history in request", async () => {
    const history = [
      { role: "user" as const, content: "hi" },
      { role: "assistant" as const, content: "hello" },
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ reply: "ok", board_updated: false })
    );

    await sendChat("user", "next", history);

    const body = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.history).toEqual(history);
  });

  it("sendChat throws on error response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: { code: "AI_ERROR", message: "API down" } }, 502)
    );

    await expect(sendChat("user", "hi", [])).rejects.toThrow("API down");
  });
});

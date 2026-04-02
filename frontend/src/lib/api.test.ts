import { fetchNamedBoard, saveNamedBoard, sendChatForBoard } from "@/lib/api";
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

  it("fetchNamedBoard returns board payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ id: 1, name: "My Board", username: "user", board: testBoard, is_default: true })
    );

    const payload = await fetchNamedBoard("user", 1);

    expect(payload.board).toEqual(testBoard);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/users/user/boards/1", {
      cache: "no-store",
      headers: {},
    });
  });

  it("saveNamedBoard sends put request and returns saved board", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ id: 1, name: "My Board", username: "user", board: testBoard, is_default: true })
    );

    const payload = await saveNamedBoard("user", 1, testBoard);

    expect(payload.board).toEqual(testBoard);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/users/user/boards/1", {
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

    await expect(fetchNamedBoard("user", 1)).rejects.toThrow(
      "Request validation failed."
    );
  });
});

describe("chat API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sendChatForBoard posts message and returns response", async () => {
    const chatResponse = { reply: "Hello!", board_updated: false };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(chatResponse)
    );

    const result = await sendChatForBoard("user", 1, "hi", []);

    expect(result).toEqual(chatResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/users/user/boards/1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi", history: [] }),
    });
  });

  it("sendChatForBoard includes history in request", async () => {
    const history = [
      { role: "user" as const, content: "hi" },
      { role: "assistant" as const, content: "hello" },
    ];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ reply: "ok", board_updated: false })
    );

    await sendChatForBoard("user", 1, "next", history);

    const body = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.history).toEqual(history);
  });

  it("sendChatForBoard throws on error response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: { code: "AI_ERROR", message: "API down" } }, 502)
    );

    await expect(sendChatForBoard("user", 1, "hi", [])).rejects.toThrow("API down");
  });
});

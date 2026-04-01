import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { AuthContext } from "@/components/AuthContext";
import type { BoardData } from "@/lib/kanban";

const testBoard: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", cardIds: ["card-4"] },
    { id: "col-review", title: "Review", cardIds: ["card-5"] },
    { id: "col-done", title: "Done", cardIds: ["card-6"] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Task one", details: "Details" },
    "card-2": { id: "card-2", title: "Task two", details: "Details" },
    "card-3": { id: "card-3", title: "Task three", details: "Details" },
    "card-4": { id: "card-4", title: "Task four", details: "Details" },
    "card-5": { id: "card-5", title: "Task five", details: "Details" },
    "card-6": { id: "card-6", title: "Task six", details: "Details" },
  },
};

const namedBoardResponse = (board: BoardData) => ({
  id: 1,
  name: "Test Board",
  username: "user",
  board,
  is_default: true,
});

const okJsonResponse = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );

const membersResponse = {
  board_id: 1,
  owner_user_id: 1,
  members: [],
};

const renderBoard = () =>
  render(
    <AuthContext.Provider value={{ token: "test-token", username: "user" }}>
      <KanbanBoard username="user" boardId={1} />
    </AuthContext.Provider>
  );

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads board data from API", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input) => {
        if (String(input).includes("/members")) {
          return okJsonResponse(membersResponse);
        }
        return okJsonResponse(namedBoardResponse(testBoard));
      });

    renderBoard();

    expect(screen.getByText(/loading board/i)).toBeInTheDocument();
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users/user/boards/1",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("sends updated board to API when renaming a column", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        if (String(input).includes("/members")) {
          return okJsonResponse(membersResponse);
        }
        if (!init?.method || init.method === "GET") {
          return okJsonResponse(namedBoardResponse(testBoard));
        }
        const updatedBoard = JSON.parse(String(init.body)) as BoardData;
        return okJsonResponse(namedBoardResponse(updatedBoard));
      });

    renderBoard();

    const column = (await screen.findAllByTestId(/column-/i))[0];
    const input = within(column).getByLabelText("Column title");

    await userEvent.clear(input);
    await userEvent.type(input, "New Name");

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        ([, init]) => init?.method === "PUT"
      );
      expect(putCalls.length).toBeGreaterThan(0);
      const containsUpdatedTitle = putCalls.some(([, init]) => {
        const payload = JSON.parse(String(init?.body)) as BoardData;
        return payload.columns[0]?.title.includes("New Name");
      });
      expect(containsUpdatedTitle).toBe(true);
    });
  });

  it("shows recoverable error when loading board fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("oops", { status: 500 }))
      .mockImplementation((input) => {
        if (String(input).includes("/members")) {
          return okJsonResponse(membersResponse);
        }
        return okJsonResponse(namedBoardResponse(testBoard));
      });

    renderBoard();

    expect(await screen.findByText(/board unavailable/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });
});

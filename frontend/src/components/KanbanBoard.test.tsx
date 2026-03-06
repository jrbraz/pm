import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
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

const apiResponse = (board: BoardData) => ({
  username: "user",
  board,
});

const okJsonResponse = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads board data from API", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        if (!init?.method || init.method === "GET") {
          return okJsonResponse(apiResponse(testBoard));
        }
        return okJsonResponse(apiResponse(testBoard));
      });

    render(<KanbanBoard username="user" />);

    expect(screen.getByText(/loading board/i)).toBeInTheDocument();
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledWith("/api/users/user/board", {
      cache: "no-store",
    });
  });

  it("sends updated board to API when renaming a column", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input, init) => {
        if (!init?.method || init.method === "GET") {
          return okJsonResponse(apiResponse(testBoard));
        }

        const updatedBoard = JSON.parse(String(init.body)) as BoardData;
        return okJsonResponse(apiResponse(updatedBoard));
      });

    render(<KanbanBoard username="user" />);

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
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("oops", { status: 500 }))
      .mockImplementation(() => okJsonResponse(apiResponse(testBoard)));

    render(<KanbanBoard username="user" />);

    expect(await screen.findByText(/board unavailable/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

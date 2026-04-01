import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardSettingsPanel } from "@/components/BoardSettingsPanel";
import { AuthContext } from "@/components/AuthContext";

const mockMembers = {
  board_id: 1,
  owner_user_id: 1,
  members: [
    {
      id: 10,
      user_id: 2,
      username: "bob",
      role: "member" as const,
      created_at: new Date().toISOString(),
      invited_by: "alice",
    },
  ],
};

const renderPanel = (onClose = vi.fn()) => {
  render(
    <AuthContext.Provider value={{ token: "test-token", username: "alice" }}>
      <BoardSettingsPanel
        username="alice"
        boardId={1}
        boardName="My Board"
        onClose={onClose}
      />
    </AuthContext.Provider>
  );
};

describe("BoardSettingsPanel", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockMembers), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders board name in header", async () => {
    renderPanel();
    expect(screen.getByText("My Board")).toBeInTheDocument();
  });

  it("shows owner row immediately", () => {
    renderPanel();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("shows existing member after load", async () => {
    renderPanel();
    await waitFor(() => screen.getByText("bob"));
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("shows invite form", () => {
    renderPanel();
    expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /invite/i })).toBeInTheDocument();
  });

  it("closes on Escape key", async () => {
    const onClose = vi.fn();
    renderPanel(onClose);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("invite button is disabled when input is empty", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /invite/i })).toBeDisabled();
  });

  it("enables invite button when username is typed", async () => {
    renderPanel();
    await userEvent.type(screen.getByPlaceholderText(/username/i), "charlie");
    expect(screen.getByRole("button", { name: /invite/i })).not.toBeDisabled();
  });

  it("shows error when invite fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockMembers), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "NOT_FOUND", message: "User not found." } }),
          { status: 404 }
        )
      );

    renderPanel();
    await waitFor(() => screen.getByText("Owner"));

    await userEvent.type(screen.getByPlaceholderText(/username/i), "nobody");
    await userEvent.click(screen.getByRole("button", { name: /invite/i }));

    await waitFor(() =>
      expect(screen.getByText(/user not found/i)).toBeInTheDocument()
    );
  });
});

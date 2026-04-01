import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";

vi.mock("@/components/KanbanBoard", () => ({
  KanbanBoard: () => <div data-testid="kanban-board">Board</div>,
}));

vi.mock("@/components/ChatSidebar", () => ({
  ChatSidebar: () => <div data-testid="chat-sidebar">Chat</div>,
}));

vi.mock("@/components/BoardSelector", () => ({
  BoardSelector: ({ onSelectBoard }: { onSelectBoard: (id: number) => void }) => {
    return <div data-testid="board-selector" onClick={() => onSelectBoard(1)}>Boards</div>;
  },
}));

vi.mock("@/components/DashboardPage", () => ({
  DashboardPage: () => <div data-testid="dashboard-page">Dashboard</div>,
}));

const mockFetch = (overrides: Record<string, unknown> = {}) => {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/api/auth/login")) {
      const body = overrides.loginFail
        ? JSON.stringify({ error: { code: "AUTH_ERROR", message: "Invalid username or password." } })
        : JSON.stringify({ token: "test-token-123", username: "testuser" });
      const status = overrides.loginFail ? 401 : 200;
      return Promise.resolve(new Response(body, { status, headers: { "Content-Type": "application/json" } }));
    }
    if (url.includes("/api/auth/logout")) {
      return Promise.resolve(new Response("{}", { status: 200 }));
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
};

describe("AuthGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows login form when unauthenticated", async () => {
    render(<AuthGate />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /project workspace/i })
      ).toBeInTheDocument()
    );
    expect(screen.queryByTestId("kanban-board")).not.toBeInTheDocument();
  });

  it("shows dashboard after login (no board selected)", async () => {
    mockFetch();
    render(<AuthGate />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), "testuser");
    await user.type(screen.getByLabelText(/password/i), "testpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByTestId("dashboard-page")).toBeInTheDocument()
    );
  });

  it("shows kanban board when a board is selected", async () => {
    mockFetch();
    render(<AuthGate />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), "testuser");
    await user.type(screen.getByLabelText(/password/i), "testpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => screen.getByTestId("board-selector"));
    await user.click(screen.getByTestId("board-selector"));

    await waitFor(() =>
      expect(screen.getByTestId("kanban-board")).toBeInTheDocument()
    );
  });

  it("shows error on invalid credentials", async () => {
    mockFetch({ loginFail: true });
    render(<AuthGate />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), "wrong");
    await user.type(screen.getByLabelText(/password/i), "creds");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/invalid username or password/i)
      ).toBeInTheDocument()
    );
    expect(screen.queryByTestId("kanban-board")).not.toBeInTheDocument();
  });

  it("shows dashboard link in sidebar when authenticated", async () => {
    mockFetch();
    render(<AuthGate />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), "testuser");
    await user.type(screen.getByLabelText(/password/i), "testpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /dashboard/i })).toBeInTheDocument()
    );
  });

  it("logs out successfully", async () => {
    mockFetch();
    render(<AuthGate />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), "testuser");
    await user.type(screen.getByLabelText(/password/i), "testpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => screen.getByRole("button", { name: /log out/i }));
    await user.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /project workspace/i })
      ).toBeInTheDocument()
    );
    expect(window.localStorage.getItem("pm-token")).toBeNull();
  });
});

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
    if (url.includes("/api/auth/register")) {
      if (overrides.registerFail) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: { code: "REGISTRATION_ERROR", message: "Username is already taken." } }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ username: "newuser", id: 1 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
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
    await user.type(screen.getByLabelText(/password/i), "testpass1");
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
    await user.type(screen.getByLabelText(/password/i), "testpass1");
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
    await user.type(screen.getByLabelText(/password/i), "badcreds1");
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
    await user.type(screen.getByLabelText(/password/i), "testpass1");
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
    await user.type(screen.getByLabelText(/password/i), "testpass1");
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

  it("restores session from localStorage", async () => {
    window.localStorage.setItem("pm-token", "stored-token");
    window.localStorage.setItem("pm-username", "storeduser");

    render(<AuthGate />);

    await waitFor(() =>
      expect(screen.getByTestId("dashboard-page")).toBeInTheDocument()
    );
    expect(screen.queryByRole("heading", { name: /project workspace/i })).not.toBeInTheDocument();
  });

  it("switches to register form and back", async () => {
    render(<AuthGate />);
    const user = userEvent.setup();

    await waitFor(() => screen.getByText(/no account/i));
    await user.click(screen.getByRole("button", { name: /register/i }));

    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("completes register + login flow", async () => {
    mockFetch();
    render(<AuthGate />);
    const user = userEvent.setup();

    // Switch to register
    await waitFor(() => screen.getByText(/no account/i));
    await user.click(screen.getByRole("button", { name: /register/i }));

    await user.type(screen.getByLabelText(/username/i), "newuser");
    await user.type(screen.getByLabelText(/password/i), "newpass12");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    // After register, app should auto-login and show dashboard
    await waitFor(() =>
      expect(screen.getByTestId("dashboard-page")).toBeInTheDocument()
    );
    expect(window.localStorage.getItem("pm-token")).toBe("test-token-123");
  });

  it("shows error on duplicate registration", async () => {
    mockFetch({ registerFail: true });
    render(<AuthGate />);
    const user = userEvent.setup();

    await waitFor(() => screen.getByText(/no account/i));
    await user.click(screen.getByRole("button", { name: /register/i }));

    await user.type(screen.getByLabelText(/username/i), "taken");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText(/already taken/i)).toBeInTheDocument()
    );
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";

vi.mock("@/components/KanbanBoard", () => ({
  KanbanBoard: () => <div data-testid="kanban-board">Board</div>,
}));

vi.mock("@/components/ChatSidebar", () => ({
  ChatSidebar: () => <div data-testid="chat-sidebar">Chat</div>,
}));

describe("AuthGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
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

  it("shows error on invalid credentials", async () => {
    render(<AuthGate />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), "wrong");
    await user.type(screen.getByLabelText(/password/i), "creds");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      screen.getByText(/invalid credentials\. use user \/ password\./i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("kanban-board")).not.toBeInTheDocument();
  });

  it("logs in with valid credentials and supports logout", async () => {
    render(<AuthGate />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username/i), "user");
    await user.type(screen.getByLabelText(/password/i), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByTestId("kanban-board")).toBeInTheDocument()
    );
    expect(window.localStorage.getItem("pm-authenticated")).toBe("true");

    await user.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /project workspace/i })
      ).toBeInTheDocument()
    );
    expect(window.localStorage.getItem("pm-authenticated")).toBeNull();
  });
});

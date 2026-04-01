import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardPage } from "@/components/DashboardPage";
import { AuthContext } from "@/components/AuthContext";

const mockDashboard = {
  username: "alice",
  total_boards: 2,
  total_cards: 15,
  total_overdue: 3,
  boards: [
    {
      id: 1,
      name: "Sprint Board",
      owner_username: "alice",
      access_role: "owner",
      is_default: true,
      card_count: 8,
      overdue: 2,
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      name: "Shared Board",
      owner_username: "bob",
      access_role: "member",
      is_default: false,
      card_count: 7,
      overdue: 1,
      updated_at: new Date().toISOString(),
    },
  ],
  recent_activity: [
    {
      id: 1,
      entity_type: "card",
      entity_id: "card-1",
      action: "created",
      detail: null,
      created_at: new Date().toISOString(),
      username: "alice",
      board_id: 1,
      board_name: "Sprint Board",
    },
  ],
};

const renderWithAuth = (onSelectBoard = vi.fn()) => {
  render(
    <AuthContext.Provider value={{ token: "test-token", username: "alice" }}>
      <DashboardPage onSelectBoard={onSelectBoard} />
    </AuthContext.Provider>
  );
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockDashboard), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    renderWithAuth();
    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });

  it("shows welcome message with username after load", async () => {
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByText(/welcome back, alice/i)).toBeInTheDocument()
    );
  });

  it("shows aggregate stats", async () => {
    renderWithAuth();
    await waitFor(() => screen.getByText(/welcome back/i));
    expect(screen.getByText("2")).toBeInTheDocument(); // boards
    expect(screen.getByText("15")).toBeInTheDocument(); // cards
    expect(screen.getByText("3")).toBeInTheDocument(); // overdue
  });

  it("shows board list", async () => {
    renderWithAuth();
    await waitFor(() => screen.getByText(/welcome back/i));
    expect(screen.getAllByText("Sprint Board").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Shared Board").length).toBeGreaterThan(0);
  });

  it("shows shared board role badge", async () => {
    renderWithAuth();
    await waitFor(() => screen.getByText(/welcome back/i));
    expect(screen.getByText("member")).toBeInTheDocument();
  });

  it("calls onSelectBoard when a board is clicked", async () => {
    const onSelectBoard = vi.fn();
    renderWithAuth(onSelectBoard);
    await waitFor(() => screen.getAllByText("Sprint Board"));

    const boardButtons = screen.getAllByRole("button");
    const sprintButton = boardButtons.find((b) => b.textContent?.includes("Sprint Board"));
    expect(sprintButton).toBeDefined();
    await userEvent.click(sprintButton!);
    expect(onSelectBoard).toHaveBeenCalledWith(1);
  });

  it("shows recent activity feed", async () => {
    renderWithAuth();
    await waitFor(() => screen.getByText(/welcome back/i));
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument()
    );
  });
});

import { render, screen } from "@testing-library/react";
import { BoardStatsBar } from "@/components/BoardStatsBar";

describe("BoardStatsBar", () => {
  it("returns null when total is 0", () => {
    const { container } = render(
      <BoardStatsBar
        total={0}
        overdue={0}
        byPriority={{ critical: 0, high: 0, medium: 0 }}
        ownerUsername="alice"
        members={[]}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows total card count", () => {
    render(
      <BoardStatsBar
        total={5}
        overdue={0}
        byPriority={{ critical: 0, high: 0, medium: 0 }}
        ownerUsername="alice"
        members={[]}
      />
    );
    expect(screen.getByText("5 cards")).toBeInTheDocument();
  });

  it("shows overdue count when > 0", () => {
    render(
      <BoardStatsBar
        total={3}
        overdue={2}
        byPriority={{ critical: 0, high: 0, medium: 0 }}
        ownerUsername="alice"
        members={[]}
      />
    );
    expect(screen.getByText("2 overdue")).toBeInTheDocument();
  });

  it("shows critical and high priority counts", () => {
    render(
      <BoardStatsBar
        total={10}
        overdue={0}
        byPriority={{ critical: 3, high: 2, medium: 0 }}
        ownerUsername="alice"
        members={[]}
      />
    );
    expect(screen.getByText("3 critical")).toBeInTheDocument();
    expect(screen.getByText("2 high")).toBeInTheDocument();
  });

  it("shows member avatars when members present", () => {
    render(
      <BoardStatsBar
        total={1}
        overdue={0}
        byPriority={{ critical: 0, high: 0, medium: 0 }}
        ownerUsername="alice"
        members={[
          { id: 1, user_id: 2, username: "bob", role: "member", created_at: "", invited_by: null },
        ]}
      />
    );
    expect(screen.getByTitle("alice")).toBeInTheDocument();
    expect(screen.getByTitle("bob")).toBeInTheDocument();
  });
});

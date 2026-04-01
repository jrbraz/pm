import { render, screen } from "@testing-library/react";
import { ActivityFeed } from "@/components/ActivityFeed";
import type { ActivityEntry } from "@/lib/kanban";

const makeEntry = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: 1,
  entity_type: "card",
  entity_id: "card-1",
  action: "created",
  detail: null,
  created_at: new Date().toISOString(),
  username: "alice",
  ...overrides,
});

describe("ActivityFeed", () => {
  it("shows empty message when no entries", () => {
    render(<ActivityFeed entries={[]} />);
    expect(screen.getByText(/no recent activity/i)).toBeInTheDocument();
  });

  it("shows custom empty message", () => {
    render(<ActivityFeed entries={[]} emptyMessage="Nothing happened yet." />);
    expect(screen.getByText("Nothing happened yet.")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<ActivityFeed entries={[]} isLoading />);
    expect(screen.getByText(/loading activity/i)).toBeInTheDocument();
  });

  it("renders activity entries with username", () => {
    const entries = [
      makeEntry({ username: "alice", action: "created", entity_type: "card" }),
      makeEntry({ id: 2, username: "bob", action: "commented", entity_type: "comment" }),
    ];
    render(<ActivityFeed entries={entries} />);
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("shows board name when showBoardName is true", () => {
    const entries = [
      makeEntry({ board_name: "Sprint Board", board_id: 1 }),
    ];
    render(<ActivityFeed entries={entries} showBoardName />);
    expect(screen.getByText(/sprint board/i)).toBeInTheDocument();
  });

  it("formats member invite action", () => {
    const entries = [
      makeEntry({
        entity_type: "member",
        action: "invited",
        entity_id: "bob",
        detail: { role: "member" },
        username: "alice",
      }),
    ];
    render(<ActivityFeed entries={entries} />);
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText(/invited bob/i)).toBeInTheDocument();
  });

  it("renders initials avatars for each entry", () => {
    const entries = [
      makeEntry({ username: "alice" }),
      makeEntry({ id: 2, username: "bob" }),
    ];
    render(<ActivityFeed entries={entries} />);
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByText("BO")).toBeInTheDocument();
  });
});

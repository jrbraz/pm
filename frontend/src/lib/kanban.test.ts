import {
  compareDueDates,
  createId,
  formatDueDateChip,
  formatRelativeTime,
  getEndOfWeekIso,
  getInitials,
  getTodayIso,
  isDueThisWeek,
  isDueToday,
  isOverdueDate,
  moveCard,
  type Column,
} from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });

  it("returns columns unchanged if active card not found", () => {
    const result = moveCard(baseColumns, "nonexistent", "card-1");
    expect(result).toEqual(baseColumns);
  });

  it("returns columns unchanged if moved to same position", () => {
    const result = moveCard(baseColumns, "card-1", "card-1");
    expect(result).toEqual(baseColumns);
  });
});

describe("createId", () => {
  it("creates id with given prefix", () => {
    const id = createId("card");
    expect(id).toMatch(/^card-/);
  });

  it("creates unique ids", () => {
    const ids = new Set(Array.from({ length: 20 }, () => createId("test")));
    expect(ids.size).toBe(20);
  });
});

describe("getInitials", () => {
  it("returns first two chars uppercase", () => {
    expect(getInitials("alice")).toBe("AL");
    expect(getInitials("bob")).toBe("BO");
  });

  it("handles single char username", () => {
    expect(getInitials("x")).toBe("X");
  });
});

describe("formatRelativeTime", () => {
  it("shows 'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it("shows minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });

  it("shows hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe("2h ago");
  });

  it("shows days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");
  });
});

describe("due date helpers", () => {
  const baseDate = new Date("2026-04-02T12:00:00");

  it("computes today and end of week in local date format", () => {
    expect(getTodayIso(baseDate)).toBe("2026-04-02");
    expect(getEndOfWeekIso(baseDate)).toBe("2026-04-04");
  });

  it("detects due today", () => {
    expect(isDueToday("2026-04-02", baseDate)).toBe(true);
    expect(isDueToday("2026-04-03", baseDate)).toBe(false);
  });

  it("detects overdue dates", () => {
    expect(isOverdueDate("2026-04-01", baseDate)).toBe(true);
    expect(isOverdueDate("2026-04-02", baseDate)).toBe(false);
  });

  it("detects dates due this week", () => {
    expect(isDueThisWeek("2026-04-03", baseDate)).toBe(true);
    expect(isDueThisWeek("2026-04-08", baseDate)).toBe(false);
  });

  it("formats due-date chips by urgency", () => {
    expect(formatDueDateChip("2026-04-01", baseDate)).toBe("Overdue");
    expect(formatDueDateChip("2026-04-02", baseDate)).toBe("Due today");
    expect(formatDueDateChip("2026-04-03", baseDate)).toBe("Due this week");
  });

  it("sorts due-dated cards ahead of undated cards", () => {
    const dueLater = { id: "a", title: "Later", details: "", due_date: "2026-04-05" };
    const dueSooner = { id: "b", title: "Sooner", details: "", due_date: "2026-04-03" };
    const noDueDate = { id: "c", title: "No date", details: "" };
    expect(compareDueDates(dueSooner, dueLater)).toBeLessThan(0);
    expect(compareDueDates(dueLater, noDueDate)).toBeLessThan(0);
  });
});

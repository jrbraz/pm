"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { KanbanColumn } from "@/components/KanbanColumn";
import { CardEditModal } from "@/components/CardEditModal";
import { fetchNamedBoard, saveNamedBoard } from "@/lib/api";
import { createId, moveCard, type BoardData, type Card, type Priority } from "@/lib/kanban";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/kanban";

type KanbanBoardProps = {
  username: string;
  boardId: number;
  refreshSignal?: number;
};

export const KanbanBoard = ({ username, boardId, refreshSignal }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [boardName, setBoardName] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | null>(null);
  const [filterLabel, setFilterLabel] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const payload = await fetchNamedBoard(username, boardId);
      setBoard(payload.board);
      setBoardName(payload.name);
    } catch {
      setErrorMessage("Unable to load board. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [username, boardId]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (refreshSignal) {
      void loadBoard();
    }
  }, [refreshSignal, loadBoard]);

  const persistBoard = useCallback(
    async (nextBoard: BoardData) => {
      setIsSaving(true);
      try {
        const payload = await saveNamedBoard(username, boardId, nextBoard);
        setBoard(payload.board);
        setErrorMessage(null);
      } catch {
        setErrorMessage("Unable to save board changes.");
      } finally {
        setIsSaving(false);
      }
    },
    [username, boardId]
  );

  const boardRef = useRef(board);
  boardRef.current = board;

  const applyBoardUpdate = useCallback(
    (updateFn: (currentBoard: BoardData) => BoardData) => {
      const currentBoard = boardRef.current;
      if (!currentBoard) return;
      const nextBoard = updateFn(currentBoard);
      setBoard(nextBoard);
      void persistBoard(nextBoard);
    },
    [persistBoard]
  );

  // Derived: all unique labels in this board
  const allLabels = useMemo(() => {
    if (!board) return [];
    const labels = new Set<string>();
    Object.values(board.cards).forEach((card) => {
      card.labels?.forEach((l) => labels.add(l));
    });
    return [...labels].sort();
  }, [board]);

  // Derived: filtered card IDs (for visual filtering)
  const filteredCardIds = useMemo(() => {
    if (!board) return new Set<string>();
    if (!searchQuery && !filterPriority && !filterLabel) return null; // null = show all
    const result = new Set<string>();
    Object.values(board.cards).forEach((card) => {
      const matchesSearch =
        !searchQuery ||
        card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.details.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = !filterPriority || card.priority === filterPriority;
      const matchesLabel =
        !filterLabel || (card.labels ?? []).includes(filterLabel);
      if (matchesSearch && matchesPriority && matchesLabel) {
        result.add(card.id);
      }
    });
    return result;
  }, [board, searchQuery, filterPriority, filterLabel]);

  // Board stats
  const boardStats = useMemo(() => {
    if (!board) return null;
    const cards = Object.values(board.cards);
    const total = cards.length;
    const byPriority = {
      critical: cards.filter((c) => c.priority === "critical").length,
      high: cards.filter((c) => c.priority === "high").length,
      medium: cards.filter((c) => c.priority === "medium").length,
    };
    const overdue = cards.filter(
      (c) =>
        c.due_date &&
        new Date(c.due_date) < new Date(new Date().toISOString().split("T")[0])
    ).length;
    return { total, byPriority, overdue };
  }, [board]);

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);
  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  // Find column title for a card (for edit modal)
  const editingCardColumnTitle = useMemo(() => {
    if (!editingCard || !board) return "";
    const col = board.columns.find((c) => c.cardIds.includes(editingCard.id));
    return col?.title ?? "";
  }, [editingCard, board]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!board || !over || active.id === over.id) {
      return;
    }

    applyBoardUpdate((currentBoard) => ({
      ...currentBoard,
      columns: moveCard(
        currentBoard.columns,
        active.id as string,
        over.id as string
      ),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    applyBoardUpdate((currentBoard) => ({
      ...currentBoard,
      columns: currentBoard.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleDeleteColumn = (columnId: string) => {
    applyBoardUpdate((currentBoard) => {
      const col = currentBoard.columns.find((c) => c.id === columnId);
      if (!col) return currentBoard;
      const removedCardIds = new Set(col.cardIds);
      return {
        columns: currentBoard.columns.filter((c) => c.id !== columnId),
        cards: Object.fromEntries(
          Object.entries(currentBoard.cards).filter(([id]) => !removedCardIds.has(id))
        ),
      };
    });
  };

  const handleAddCard = (
    columnId: string,
    title: string,
    details: string,
    priority?: Priority | null,
    labels?: string[],
    dueDate?: string | null
  ) => {
    const id = createId("card");
    applyBoardUpdate((currentBoard) => ({
      ...currentBoard,
      cards: {
        ...currentBoard.cards,
        [id]: {
          id,
          title,
          details: details || "No details yet.",
          priority: priority ?? null,
          labels: labels ?? [],
          due_date: dueDate ?? null,
        },
      },
      columns: currentBoard.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    applyBoardUpdate((currentBoard) => ({
      ...currentBoard,
      cards: Object.fromEntries(
        Object.entries(currentBoard.cards).filter(([id]) => id !== cardId)
      ),
      columns: currentBoard.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }
          : column
      ),
    }));
  };

  const handleEditCard = (card: Card) => {
    setEditingCard(card);
  };

  const handleSaveCard = (updated: Card) => {
    applyBoardUpdate((currentBoard) => ({
      ...currentBoard,
      cards: {
        ...currentBoard.cards,
        [updated.id]: updated,
      },
    }));
  };

  const handleAddColumn = () => {
    const id = createId("col");
    applyBoardUpdate((currentBoard) => ({
      ...currentBoard,
      columns: [...currentBoard.columns, { id, title: "New Column", cardIds: [] }],
    }));
  };

  const hasActiveFilter = searchQuery || filterPriority || filterLabel;

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)]">
        <p className="text-sm font-semibold text-[var(--gray-text)]">Loading board...</p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
        <section className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-white p-8 text-center shadow-[var(--shadow)]">
          <h1 className="font-display text-2xl font-semibold text-[var(--navy-dark)]">
            Board unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
            {errorMessage || "Unable to load board."}
          </p>
          <button
            type="button"
            onClick={() => void loadBoard()}
            className="mt-6 rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.2)_0%,_rgba(32,157,215,0.04)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.15)_0%,_rgba(117,57,145,0.04)_55%,_transparent_75%)]" />

      <main className="relative flex min-h-screen flex-col gap-4 px-6 pb-16 pt-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
              Project Board
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-[var(--navy-dark)]">
              {boardName || "Kanban Studio"}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {errorMessage ? (
              <p
                className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-medium text-[var(--secondary-purple)]"
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}
            <span
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
              data-testid="save-status"
            >
              {isSaving ? "Saving..." : "Saved"}
            </span>
          </div>
        </header>

        {/* Stats row */}
        {boardStats && boardStats.total > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--stroke)] bg-white px-3 py-1 text-xs font-semibold text-[var(--navy-dark)]">
              {boardStats.total} cards
            </span>
            {boardStats.overdue > 0 && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-500">
                {boardStats.overdue} overdue
              </span>
            )}
            {boardStats.byPriority.critical > 0 && (
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: PRIORITY_COLORS.critical + "1a", color: PRIORITY_COLORS.critical }}
              >
                {boardStats.byPriority.critical} critical
              </span>
            )}
            {boardStats.byPriority.high > 0 && (
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: PRIORITY_COLORS.high + "1a", color: PRIORITY_COLORS.high }}
              >
                {boardStats.byPriority.high} high
              </span>
            )}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gray-text)]"
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.44 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cards..."
              className="w-full rounded-xl border border-[var(--stroke)] bg-white py-1.5 pl-8 pr-3 text-xs text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            />
          </div>

          {/* Priority filter pills */}
          <div className="flex items-center gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFilterPriority(filterPriority === p ? null : p)}
                className="rounded-full border px-2.5 py-1 text-[10px] font-semibold transition"
                style={
                  filterPriority === p
                    ? {
                        backgroundColor: PRIORITY_COLORS[p] + "22",
                        color: PRIORITY_COLORS[p],
                        borderColor: PRIORITY_COLORS[p] + "66",
                      }
                    : {
                        borderColor: PRIORITY_COLORS[p] + "33",
                        color: PRIORITY_COLORS[p] + "99",
                      }
                }
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Label filter */}
          {allLabels.length > 0 && (
            <select
              value={filterLabel}
              onChange={(e) => setFilterLabel(e.target.value)}
              className="rounded-xl border border-[var(--stroke)] bg-white px-2 py-1.5 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            >
              <option value="">All labels</option>
              {allLabels.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}

          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setFilterPriority(null);
                setFilterLabel("");
              }}
              className="rounded-xl border border-[var(--stroke)] px-2.5 py-1.5 text-xs font-medium text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Clear
            </button>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto pb-2">
            <div
              className="flex gap-4"
              style={{ minWidth: `${(board.columns.length + 1) * 220}px` }}
            >
              {board.columns.map((column) => {
                // Apply filter: only show matching cards (but preserve cardIds for dnd)
                const visibleCards = column.cardIds
                  .map((cardId) => board.cards[cardId])
                  .filter((card): card is Card => {
                    if (!card) return false;
                    if (filteredCardIds === null) return true; // no filter
                    return filteredCardIds.has(card.id);
                  });

                return (
                  <div key={column.id} className="group" style={{ flex: "1 0 0", minWidth: "200px" }}>
                    <KanbanColumn
                      column={column}
                      cards={visibleCards}
                      onRename={handleRenameColumn}
                      onAddCard={handleAddCard}
                      onDeleteCard={handleDeleteCard}
                      onEditCard={handleEditCard}
                      onDeleteColumn={handleDeleteColumn}
                    />
                  </div>
                );
              })}
              {/* Add column button */}
              <div style={{ flex: "0 0 auto", minWidth: "200px" }}>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--stroke)] bg-white/50 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z" />
                  </svg>
                  Add Column
                </button>
              </div>
            </div>
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[220px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Card edit modal */}
      {editingCard && (
        <CardEditModal
          card={editingCard}
          columnTitle={editingCardColumnTitle}
          onSave={handleSaveCard}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
};

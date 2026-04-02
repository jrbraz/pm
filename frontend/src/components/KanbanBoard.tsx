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
import { CardDetailPanel } from "@/components/CardDetailPanel";
import { BoardSettingsPanel } from "@/components/BoardSettingsPanel";
import { BoardStatsBar } from "@/components/BoardStatsBar";
import {
  BoardFilterBar,
  type CardSortMode,
  type DueDateFilter,
} from "@/components/BoardFilterBar";
import { PlusIcon, GearIcon } from "@/components/Icons";
import { fetchBoardMembers, fetchNamedBoard, reserveNextCardId, saveNamedBoard } from "@/lib/api";
import { useDebouncedCallback } from "@/lib/useDebounce";
import {
  ALLOWED_CHILD_TYPES,
  compareDueDates,
  createId,
  isDueThisWeek,
  isDueToday,
  isOverdueDate,
  moveCard,
  type BoardData,
  type Card,
  type CardType,
  type BoardMember,
  type Priority,
} from "@/lib/kanban";
import { useAuth } from "@/components/AuthContext";

type KanbanBoardProps = {
  username: string;
  boardId: number;
  refreshSignal?: number;
};

export const KanbanBoard = ({ username, boardId, refreshSignal }: KanbanBoardProps) => {
  const { token } = useAuth();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [boardName, setBoardName] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | null>(null);
  const [filterDueDate, setFilterDueDate] = useState<DueDateFilter>("all");
  const [filterCardType, setFilterCardType] = useState<CardType | null>(null);
  const [filterLabel, setFilterLabel] = useState("");
  const [sortMode, setSortMode] = useState<CardSortMode>("manual");
  const [externalUpdate, setExternalUpdate] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const payload = await fetchNamedBoard(username, boardId, token || undefined);
      setBoard(payload.board);
      setBoardName(payload.name);
    } catch {
      setErrorMessage("Unable to load board. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [username, boardId, token]);

  const loadMembers = useCallback(async () => {
    if (!token) return;
    try {
      const { members: m } = await fetchBoardMembers(username, boardId, token);
      setMembers(m);
    } catch {
      // Non-fatal: members just won't show in assignee list
    }
  }, [username, boardId, token]);

  useEffect(() => {
    void loadBoard();
    void loadMembers();
  }, [loadBoard, loadMembers]);

  useEffect(() => {
    if (refreshSignal) {
      setExternalUpdate(true);
    }
  }, [refreshSignal]);

  const persistBoard = useCallback(
    async (nextBoard: BoardData) => {
      setIsSaving(true);
      try {
        const payload = await saveNamedBoard(username, boardId, nextBoard, token || undefined);
        setBoard(payload.board);
        setErrorMessage(null);
      } catch {
        setErrorMessage("Unable to save board changes.");
      } finally {
        setIsSaving(false);
      }
    },
    [username, boardId, token]
  );

  const debouncedPersist = useDebouncedCallback(
    (nextBoard: BoardData) => { void persistBoard(nextBoard); },
    500,
  );

  const boardRef = useRef(board);
  boardRef.current = board;

  const applyBoardUpdate = useCallback(
    (updateFn: (currentBoard: BoardData) => BoardData) => {
      const currentBoard = boardRef.current;
      if (!currentBoard) return;
      const nextBoard = updateFn(currentBoard);
      setBoard(nextBoard);
      debouncedPersist(nextBoard);
    },
    [debouncedPersist]
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
    if (!searchQuery && !filterPriority && filterDueDate === "all" && !filterCardType && !filterLabel) return null;
    const result = new Set<string>();
    Object.values(board.cards).forEach((card) => {
      if (card.card_type === "sub_task") return; // sub-tasks don't appear in columns
      const matchesSearch =
        !searchQuery ||
        card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.details.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = !filterPriority || card.priority === filterPriority;
      const matchesDueDate =
        filterDueDate === "all" ||
        (filterDueDate === "today" && isDueToday(card.due_date)) ||
        (filterDueDate === "week" && isDueThisWeek(card.due_date)) ||
        (filterDueDate === "overdue" && isOverdueDate(card.due_date));
      const matchesCardType = !filterCardType || card.card_type === filterCardType;
      const matchesLabel =
        !filterLabel || (card.labels ?? []).includes(filterLabel);
      if (matchesSearch && matchesPriority && matchesDueDate && matchesCardType && matchesLabel) {
        result.add(card.id);
      }
    });
    return result;
  }, [board, searchQuery, filterPriority, filterDueDate, filterCardType, filterLabel]);

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
      (c) => isOverdueDate(c.due_date)
    ).length;
    return { total, byPriority, overdue };
  }, [board]);

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);
  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  // Find column title for a card (for detail panel)
  const editingCardColumnTitle = useMemo(() => {
    if (!editingCard || !board) return "";
    const col = board.columns.find((c) => c.cardIds.includes(editingCard.id));
    return col?.title ?? "";
  }, [editingCard, board]);

  // All board member usernames (owner + members) for assignee selection
  const allMemberUsernames = useMemo(() => {
    const names = new Set([username]);
    members.forEach((m) => names.add(m.username));
    return [...names];
  }, [username, members]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!board || !over || active.id === over.id) {
      return;
    }

    if (sortMode !== "manual") {
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

  const handleAddCard = async (
    columnId: string,
    title: string,
    details: string,
    cardType: CardType,
    priority?: Priority | null,
    labels?: string[],
    dueDate?: string | null
  ) => {
    if (!token) return;
    try {
      const id = await reserveNextCardId(username, token, cardType);
      const isSub = cardType === "sub_task";
      applyBoardUpdate((currentBoard) => ({
        ...currentBoard,
        cards: {
          ...currentBoard.cards,
          [id]: {
            id,
            title,
            details: details || "",
            card_type: cardType,
            parent_id: null,
            priority: priority ?? null,
            labels: labels ?? [],
            due_date: dueDate ?? null,
            checklist: [],
            assignee_ids: [],
            created_by: username,
          },
        },
        // Sub-tasks don't go in columns
        columns: isSub
          ? currentBoard.columns
          : currentBoard.columns.map((column) =>
              column.id === columnId
                ? { ...column, cardIds: [...column.cardIds, id] }
                : column
            ),
      }));
    } catch {
      setErrorMessage("Failed to create card.");
    }
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

  const handleDuplicateCard = async (columnId: string, card: Card) => {
    if (!token) return;
    try {
      const newId = await reserveNextCardId(username, token, card.card_type ?? "initiative");
      applyBoardUpdate((currentBoard) => ({
        ...currentBoard,
        cards: {
          ...currentBoard.cards,
          [newId]: {
            ...card,
            id: newId,
            created_by: username,
          },
        },
        columns: currentBoard.columns.map((col) =>
          col.id === columnId
            ? { ...col, cardIds: [...col.cardIds, newId] }
            : col
        ),
      }));
    } catch {
      setErrorMessage("Failed to duplicate card.");
    }
  };

  const handleAddChildCard = async (columnId: string, parentCard: Card, childType: CardType) => {
    if (!token) return;
    const parentType = parentCard.card_type ?? "initiative";
    const childTypes = ALLOWED_CHILD_TYPES[parentType];
    if (childTypes.length === 0) return;
    const resolvedType = childType ?? childTypes[0];
    try {
      const id = await reserveNextCardId(username, token, resolvedType);
      const isSub = resolvedType === "sub_task";
      const newCard: Card = {
        id,
        title: "",
        details: "",
        card_type: resolvedType,
        parent_id: parentCard.id,
        priority: null,
        labels: [],
        due_date: null,
        checklist: [],
        assignee_ids: [],
        created_by: username,
      };
      applyBoardUpdate((currentBoard) => ({
        ...currentBoard,
        cards: { ...currentBoard.cards, [id]: newCard },
        columns: isSub
          ? currentBoard.columns
          : currentBoard.columns.map((col) =>
              col.id === columnId
                ? { ...col, cardIds: [...col.cardIds, id] }
                : col
            ),
      }));
      // Open the detail panel for the new child card
      setEditingCard(newCard);
    } catch {
      setErrorMessage("Failed to create child card.");
    }
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
    setEditingCard(null);
  };

  const handleAddColumn = () => {
    const id = createId("col");
    applyBoardUpdate((currentBoard) => ({
      ...currentBoard,
      columns: [...currentBoard.columns, { id, title: "New Column", cardIds: [] }],
    }));
  };

  const hasActiveFilter = !!(searchQuery || filterPriority || filterLabel || filterCardType || filterDueDate !== "all");

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setFilterPriority(null);
    setFilterDueDate("all");
    setFilterCardType(null);
    setFilterLabel("");
  }, []);

  const handleAcceptExternalUpdate = useCallback(() => {
    setExternalUpdate(false);
    void loadBoard();
  }, [loadBoard]);

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

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.2)_0%,_rgba(32,157,215,0.04)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.15)_0%,_rgba(117,57,145,0.04)_55%,_transparent_75%)]" />

      <main className="relative flex min-h-0 flex-1 flex-col gap-4 px-6 pb-4 pt-8">
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
            {/* Settings button */}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="rounded-xl border border-[var(--stroke)] bg-white p-2 text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
              title="Board settings"
            >
              <GearIcon />
            </button>
          </div>
        </header>

        {/* External update notification (4.3) */}
        {externalUpdate && (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--primary-blue)] bg-blue-50 px-4 py-2">
            <p className="flex-1 text-xs font-medium text-[var(--navy-dark)]">
              The board was updated externally (via AI chat). Reload to see the latest changes.
            </p>
            <button
              type="button"
              onClick={handleAcceptExternalUpdate}
              className="shrink-0 rounded-full bg-[var(--primary-blue)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition hover:brightness-110"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => setExternalUpdate(false)}
              className="shrink-0 text-xs font-medium text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
            >
              Dismiss
            </button>
          </div>
        )}

        {boardStats && (
          <BoardStatsBar
            total={boardStats.total}
            overdue={boardStats.overdue}
            byPriority={boardStats.byPriority}
            ownerUsername={username}
            members={members}
          />
        )}

        <BoardFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterPriority={filterPriority}
          onFilterPriorityChange={setFilterPriority}
          filterDueDate={filterDueDate}
          onFilterDueDateChange={setFilterDueDate}
          filterCardType={filterCardType}
          onFilterCardTypeChange={setFilterCardType}
          filterLabel={filterLabel}
          onFilterLabelChange={setFilterLabel}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          allLabels={allLabels}
          hasActiveFilter={hasActiveFilter}
          onClearFilters={handleClearFilters}
        />

        {sortMode === "due-date" && (
          <div className="rounded-xl border border-[var(--primary-blue)]/20 bg-[var(--primary-blue)]/5 px-4 py-2 text-xs font-medium text-[var(--navy-dark)]">
            Cards are sorted by due date inside each column. Drag and drop is disabled in this view.
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="min-h-0 flex-1 overflow-x-auto pb-2">
            <div
              className="flex h-full gap-4"
              style={{ minWidth: `${(board.columns.length + 1) * 220}px` }}
            >
              {board.columns.map((column) => {
                const visibleCards = column.cardIds
                  .map((cardId) => board.cards[cardId])
                  .filter((card): card is Card => {
                    if (!card) return false;
                    if (filteredCardIds === null) return true;
                    return filteredCardIds.has(card.id);
                  });
                const orderedCards =
                  sortMode === "due-date"
                    ? [...visibleCards].sort(compareDueDates)
                    : visibleCards;

                return (
                  <div key={column.id} className="group" style={{ flex: "1 0 0", minWidth: "200px" }}>
                    <KanbanColumn
                      column={column}
                      cards={orderedCards}
                      allCards={board.cards}
                      onRename={handleRenameColumn}
                      onAddCard={handleAddCard}
                      onDeleteCard={handleDeleteCard}
                      onEditCard={handleEditCard}
                      onDuplicateCard={handleDuplicateCard}
                      onAddChildCard={handleAddChildCard}
                      onDeleteColumn={handleDeleteColumn}
                      dragDisabled={sortMode !== "manual"}
                    />
                  </div>
                );
              })}
              {/* Add column button */}
              <div style={{ flex: "0 0 auto" }}>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-[var(--stroke)] bg-white/70 text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                  title="Add column"
                >
                  <PlusIcon size={16} />
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

      {/* Card detail panel */}
      {editingCard && (
        <CardDetailPanel
          card={editingCard}
          columnTitle={editingCardColumnTitle}
          username={username}
          boardId={boardId}
          boardMembers={allMemberUsernames}
          onSave={handleSaveCard}
          onClose={() => setEditingCard(null)}
        />
      )}

      {/* Board settings panel */}
      {showSettings && (
        <BoardSettingsPanel
          username={username}
          boardId={boardId}
          boardName={boardName}
          onClose={() => { setShowSettings(false); void loadMembers(); }}
        />
      )}
    </div>
  );
};

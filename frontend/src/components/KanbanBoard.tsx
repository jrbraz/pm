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
import { fetchBoard, saveBoard } from "@/lib/api";
import { createId, moveCard, type BoardData } from "@/lib/kanban";

type KanbanBoardProps = {
  username: string;
  refreshSignal?: number;
};

export const KanbanBoard = ({ username, refreshSignal }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const loadedBoard = await fetchBoard(username);
      setBoard(loadedBoard);
    } catch {
      setErrorMessage("Unable to load board. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [username]);

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
        const savedBoard = await saveBoard(username, nextBoard);
        setBoard(savedBoard);
        setErrorMessage(null);
      } catch {
        setErrorMessage("Unable to save board changes.");
      } finally {
        setIsSaving(false);
      }
    },
    [username]
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

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);
  const activeCard = activeCardId ? cardsById[activeCardId] : null;

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

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    applyBoardUpdate((currentBoard) => ({
      ...currentBoard,
      cards: {
        ...currentBoard.cards,
        [id]: { id, title, details: details || "No details yet." },
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
    <div className="relative">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.2)_0%,_rgba(32,157,215,0.04)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.15)_0%,_rgba(117,57,145,0.04)_55%,_transparent_75%)]" />

      <main className="relative flex min-h-screen flex-col gap-6 px-6 pb-16 pt-8">
        {/* Compact header */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
              Single Board Kanban
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-[var(--navy-dark)]">
              Kanban Studio
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

        {/* Columns — scrolls horizontally when viewport is narrow */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto pb-2">
            <div
              className="flex gap-4"
              style={{ minWidth: `${board.columns.length * 220}px` }}
            >
              {board.columns.map((column) => (
                <div key={column.id} style={{ flex: "1 0 0", minWidth: "200px" }}>
                  <KanbanColumn
                    column={column}
                    cards={column.cardIds
                      .map((cardId) => board.cards[cardId])
                      .filter(
                        (card): card is (typeof board.cards)[string] => Boolean(card)
                      )}
                    onRename={handleRenameColumn}
                    onAddCard={handleAddCard}
                    onDeleteCard={handleDeleteCard}
                  />
                </div>
              ))}
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
    </div>
  );
};

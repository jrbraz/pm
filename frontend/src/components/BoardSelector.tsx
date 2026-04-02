"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createBoard, deleteBoard, duplicateBoard, listBoards, renameBoard } from "@/lib/api";
import type { BoardSummary } from "@/lib/kanban";
import { useAuth } from "@/components/AuthContext";

type BoardSelectorProps = {
  username: string;
  activeBoardId: number | null;
  onSelectBoard: (boardId: number) => void;
};

export const BoardSelector = ({
  username,
  activeBoardId,
  onSelectBoard,
}: BoardSelectorProps) => {
  const { token } = useAuth();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const loadBoards = async () => {
    setIsLoading(true);
    try {
      const loaded = await listBoards(username, token || undefined);
      setBoards(loaded);
      if (loaded.length > 0 && activeBoardId === null) {
        const defaultBoard = loaded.find((b) => b.is_default) ?? loaded[0];
        onSelectBoard(defaultBoard.id);
      }
    } catch {
      // silently ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBoards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  useEffect(() => {
    if (renamingId !== null) {
      renameInputRef.current?.focus();
    }
  }, [renamingId]);

  // Auto-clear error after 4 seconds
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const name = newBoardName.trim();
    if (!name) return;
    setErrorMessage(null);
    try {
      const created = await createBoard(username, name, token || undefined);
      setBoards((prev) => [
        ...prev,
        {
          id: created.id,
          name: created.name,
          is_default: created.is_default,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      setNewBoardName("");
      setIsCreating(false);
      onSelectBoard(created.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create board.");
    }
  };

  const handleDelete = async (boardId: number) => {
    if (boards.length <= 1) return;
    setErrorMessage(null);
    try {
      await deleteBoard(username, boardId, token || undefined);
      const remaining = boards.filter((b) => b.id !== boardId);
      setBoards(remaining);
      if (activeBoardId === boardId && remaining.length > 0) {
        onSelectBoard(remaining[0].id);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete board.");
    }
  };

  const startRename = (board: BoardSummary) => {
    setRenamingId(board.id);
    setRenameValue(board.name);
    setErrorMessage(null);
  };

  const handleDuplicate = async (board: BoardSummary) => {
    setErrorMessage(null);
    try {
      const dup = await duplicateBoard(username, board.id, `${board.name} (Copy)`, token || undefined);
      setBoards((prev) => [
        ...prev,
        {
          id: dup.id,
          name: dup.name,
          is_default: dup.is_default,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      onSelectBoard(dup.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to duplicate board.");
    }
  };

  const commitRename = async (boardId: number) => {
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    setErrorMessage(null);
    try {
      await renameBoard(username, boardId, name, token || undefined);
      setBoards((prev) =>
        prev.map((b) => (b.id === boardId ? { ...b, name } : b))
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to rename board.");
    }
    setRenamingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="text-xs text-[var(--gray-text)]">Loading boards...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {errorMessage && (
        <div className="mx-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5">
          <p className="text-[10px] font-medium text-red-600">{errorMessage}</p>
        </div>
      )}

      {boards.map((board) => (
        <div
          key={board.id}
          className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 transition ${
            activeBoardId === board.id
              ? "bg-[var(--primary-blue)]/10 text-[var(--primary-blue)]"
              : "hover:bg-[var(--stroke)] text-[var(--navy-dark)]"
          }`}
        >
          {renamingId === board.id ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => void commitRename(board.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void commitRename(board.id);
                if (e.key === "Escape") setRenamingId(null);
              }}
              className="min-w-0 flex-1 rounded bg-white px-1 text-xs font-medium text-[var(--navy-dark)] outline outline-1 outline-[var(--primary-blue)]"
            />
          ) : (
            <button
              type="button"
              onClick={() => onSelectBoard(board.id)}
              className="min-w-0 flex-1 truncate text-left text-xs font-medium"
            >
              {board.name}
            </button>
          )}

          <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              title="Duplicate board"
              onClick={() => void handleDuplicate(board)}
              className="rounded p-0.5 text-[var(--gray-text)] hover:text-[var(--primary-blue)]"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
              </svg>
            </button>
            <button
              type="button"
              title="Rename board"
              onClick={() => startRename(board)}
              className="rounded p-0.5 text-[var(--gray-text)] hover:text-[var(--primary-blue)]"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086zM11.189 6.25 9.75 4.81 3.515 11.047a.25.25 0 0 0-.063.108l-.652 2.278 2.278-.651a.25.25 0 0 0 .108-.063L11.19 6.25z" />
              </svg>
            </button>
            {boards.length > 1 && (
              <button
                type="button"
                title="Delete board"
                onClick={() => void handleDelete(board.id)}
                className="rounded p-0.5 text-[var(--gray-text)] hover:text-red-500"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}

      {isCreating ? (
        <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-1 px-2 py-1">
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Board name..."
              className="min-w-0 flex-1 rounded border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            />
            <button
              type="submit"
              className="rounded bg-[var(--primary-blue)] px-2 py-1 text-xs font-semibold text-white"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewBoardName("");
                setErrorMessage(null);
              }}
              className="text-xs text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--gray-text)] transition hover:bg-[var(--stroke)] hover:text-[var(--navy-dark)]"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z" />
          </svg>
          New board
        </button>
      )}
    </div>
  );
};

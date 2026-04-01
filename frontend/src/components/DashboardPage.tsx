"use client";

import { useEffect, useState } from "react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { fetchDashboard } from "@/lib/api";
import { type DashboardData } from "@/lib/kanban";
import { useAuth } from "@/components/AuthContext";

type DashboardPageProps = {
  onSelectBoard: (boardId: number) => void;
};

export const DashboardPage = ({ onSelectBoard }: DashboardPageProps) => {
  const { token, username } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetchDashboard(username, token)
      .then(setData)
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setIsLoading(false));
  }, [username, token]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface)]">
        <p className="text-sm font-semibold text-[var(--gray-text)]">Loading dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface)]">
        <p className="text-sm text-[var(--gray-text)]">{error ?? "No data available."}</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--surface)] px-6 pb-16 pt-8">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.15)_0%,_rgba(32,157,215,0.04)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.12)_0%,_rgba(117,57,145,0.03)_55%,_transparent_75%)]" />

      <div className="relative mx-auto max-w-3xl">
        {/* Header */}
        <header className="mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Overview
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-[var(--navy-dark)]">
            Welcome back, {username}
          </h1>
        </header>

        {/* Stats row */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[var(--stroke)] bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Boards
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-[var(--navy-dark)]">
              {data.total_boards}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--stroke)] bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Total Cards
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-[var(--navy-dark)]">
              {data.total_cards}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--stroke)] bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Overdue
            </p>
            <p
              className="mt-1 font-display text-3xl font-bold"
              style={{ color: data.total_overdue > 0 ? "#e53e3e" : "var(--navy-dark)" }}
            >
              {data.total_overdue}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-6">
          {/* Boards list */}
          <div className="col-span-3">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Your Boards
            </p>
            {data.boards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--stroke)] bg-white p-6 text-center">
                <p className="text-sm text-[var(--gray-text)]">
                  No boards yet. Create one in the sidebar.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {data.boards.map((board) => (
                  <li key={board.id}>
                    <button
                      type="button"
                      onClick={() => onSelectBoard(board.id)}
                      className="group w-full rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-left shadow-sm transition hover:border-[var(--primary-blue)] hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[var(--navy-dark)] truncate group-hover:text-[var(--primary-blue)] transition">
                              {board.name}
                            </p>
                            {board.access_role !== "owner" && (
                              <span className="shrink-0 rounded-full border border-[var(--stroke)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--gray-text)]">
                                {board.access_role}
                              </span>
                            )}
                          </div>
                          {board.access_role !== "owner" && (
                            <p className="text-[10px] text-[var(--gray-text)]">
                              by {board.owner_username}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold text-[var(--navy-dark)]">
                            {board.card_count} cards
                          </p>
                          {board.overdue > 0 && (
                            <p className="text-[10px] font-semibold text-red-500">
                              {board.overdue} overdue
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Activity feed */}
          <div className="col-span-2">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Recent Activity
            </p>
            <div className="rounded-2xl border border-[var(--stroke)] bg-white p-4">
              <ActivityFeed
                entries={data.recent_activity}
                showBoardName
                emptyMessage="No recent activity across your boards."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

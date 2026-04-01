"use client";

import { formatRelativeTime, type ActivityEntry } from "@/lib/kanban";

const ACTION_LABELS: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  renamed: "renamed",
  moved: "moved",
  invited: "invited",
  removed: "removed",
  role_changed: "changed role of",
  commented: "commented on",
};

const ENTITY_LABELS: Record<string, string> = {
  board: "board",
  card: "card",
  column: "column",
  member: "member",
  comment: "card",
};

function formatActivityEntry(entry: ActivityEntry): string {
  const action = ACTION_LABELS[entry.action] ?? entry.action;
  const entity = ENTITY_LABELS[entry.entity_type] ?? entry.entity_type;

  if (entry.entity_type === "member") {
    return `${action} ${entry.entity_id} as ${entry.detail?.role ?? "member"}`;
  }
  if (entry.entity_type === "board" && entry.action === "renamed") {
    return `renamed board to "${entry.detail?.name ?? entry.entity_id}"`;
  }
  if (entry.entity_type === "comment") {
    return `commented on ${entity} ${entry.entity_id}`;
  }
  return `${action} ${entity}`;
}

type ActivityFeedProps = {
  entries: ActivityEntry[];
  isLoading?: boolean;
  showBoardName?: boolean;
  emptyMessage?: string;
};

export const ActivityFeed = ({
  entries,
  isLoading = false,
  showBoardName = false,
  emptyMessage = "No recent activity.",
}: ActivityFeedProps) => {
  if (isLoading) {
    return <p className="text-xs text-[var(--gray-text)]">Loading activity...</p>;
  }

  if (entries.length === 0) {
    return <p className="text-xs text-[var(--gray-text)]">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-2.5">
          <div
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ backgroundColor: "var(--secondary-purple)" }}
          >
            {entry.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--navy-dark)]">
              <span className="font-semibold">{entry.username}</span>{" "}
              <span className="text-[var(--gray-text)]">{formatActivityEntry(entry)}</span>
              {showBoardName && entry.board_name && (
                <span className="text-[var(--gray-text)]"> in <span className="font-medium">{entry.board_name}</span></span>
              )}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--gray-text)]">
              {formatRelativeTime(entry.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
};

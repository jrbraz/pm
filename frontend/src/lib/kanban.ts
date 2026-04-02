export type Priority = "low" | "medium" | "high" | "critical";

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type Card = {
  id: string;
  title: string;
  details: string;
  priority?: Priority | null;
  labels?: string[];
  due_date?: string | null;
  checklist?: ChecklistItem[];
  assignee_ids?: string[];
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};

export type BoardSummary = {
  id: number;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type BoardMember = {
  id: number;
  user_id: number;
  username: string;
  role: "owner" | "member" | "viewer";
  created_at: string;
  invited_by: string | null;
};

export type Comment = {
  id: number;
  card_id: string;
  user_id: number;
  username: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type ActivityEntry = {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
  username: string;
  board_id?: number;
  board_name?: string;
};

export type DashboardData = {
  username: string;
  total_boards: number;
  total_cards: number;
  total_overdue: number;
  boards: Array<{
    id: number;
    name: string;
    owner_username: string;
    access_role: string;
    is_default: boolean;
    card_count: number;
    overdue: number;
    updated_at: string;
  }>;
  recent_activity: ActivityEntry[];
};

const isColumnId = (columns: Column[], id: string) =>
  columns.some((column) => column.id === id);

const findColumnId = (columns: Column[], id: string) => {
  if (isColumnId(columns, id)) {
    return id;
  }
  return columns.find((column) => column.cardIds.includes(id))?.id;
};

export const moveCard = (
  columns: Column[],
  activeId: string,
  overId: string
): Column[] => {
  const activeColumnId = findColumnId(columns, activeId);
  const overColumnId = findColumnId(columns, overId);

  if (!activeColumnId || !overColumnId) {
    return columns;
  }

  const activeColumn = columns.find((column) => column.id === activeColumnId);
  const overColumn = columns.find((column) => column.id === overColumnId);

  if (!activeColumn || !overColumn) {
    return columns;
  }

  const isOverColumn = isColumnId(columns, overId);

  if (activeColumnId === overColumnId) {
    if (isOverColumn) {
      const nextCardIds = activeColumn.cardIds.filter(
        (cardId) => cardId !== activeId
      );
      nextCardIds.push(activeId);
      return columns.map((column) =>
        column.id === activeColumnId
          ? { ...column, cardIds: nextCardIds }
          : column
      );
    }

    const oldIndex = activeColumn.cardIds.indexOf(activeId);
    const newIndex = activeColumn.cardIds.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return columns;
    }

    const nextCardIds = [...activeColumn.cardIds];
    nextCardIds.splice(oldIndex, 1);
    nextCardIds.splice(newIndex, 0, activeId);

    return columns.map((column) =>
      column.id === activeColumnId
        ? { ...column, cardIds: nextCardIds }
        : column
    );
  }

  const activeIndex = activeColumn.cardIds.indexOf(activeId);
  if (activeIndex === -1) {
    return columns;
  }

  const nextActiveCardIds = [...activeColumn.cardIds];
  nextActiveCardIds.splice(activeIndex, 1);

  const nextOverCardIds = [...overColumn.cardIds];
  if (isOverColumn) {
    nextOverCardIds.push(activeId);
  } else {
    const overIndex = overColumn.cardIds.indexOf(overId);
    const insertIndex = overIndex === -1 ? nextOverCardIds.length : overIndex;
    nextOverCardIds.splice(insertIndex, 0, activeId);
  }

  return columns.map((column) => {
    if (column.id === activeColumnId) {
      return { ...column, cardIds: nextActiveCardIds };
    }
    if (column.id === overColumnId) {
      return { ...column, cardIds: nextOverCardIds };
    }
    return column;
  });
};

export const createId = (prefix: string) => {
  const uuid = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}-${uuid}`;
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: "#888888",
  medium: "#209dd7",
  high: "#ecad0a",
  critical: "#e53e3e",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const formatRelativeTime = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export const getInitials = (username: string): string => {
  return username.slice(0, 2).toUpperCase();
};

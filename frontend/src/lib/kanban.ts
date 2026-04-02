export type Priority = "low" | "medium" | "high" | "critical";

export type CardType = "initiative" | "epic" | "task" | "story" | "change_scope" | "sub_task";

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type Card = {
  id: string;
  title: string;
  details: string;
  card_type?: CardType;
  parent_id?: string | null;
  priority?: Priority | null;
  labels?: string[];
  due_date?: string | null;
  checklist?: ChecklistItem[];
  assignee_ids?: string[];
  created_by?: string | null;
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

const formatDateIso = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export const getTodayIso = (now: Date = new Date()): string => formatDateIso(now);

export const getEndOfWeekIso = (now: Date = new Date()): string => {
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
  return formatDateIso(endOfWeek);
};

export const isDueToday = (
  dueDate: string | null | undefined,
  now: Date = new Date()
): boolean => {
  if (!dueDate) return false;
  return dueDate === getTodayIso(now);
};

export const isOverdueDate = (
  dueDate: string | null | undefined,
  now: Date = new Date()
): boolean => {
  if (!dueDate) return false;
  return dueDate < getTodayIso(now);
};

export const isDueThisWeek = (
  dueDate: string | null | undefined,
  now: Date = new Date()
): boolean => {
  if (!dueDate) return false;
  const today = getTodayIso(now);
  return dueDate >= today && dueDate <= getEndOfWeekIso(now);
};

export const compareDueDates = (left: Card, right: Card): number => {
  const leftDue = left.due_date ?? "9999-12-31";
  const rightDue = right.due_date ?? "9999-12-31";

  if (leftDue !== rightDue) {
    return leftDue.localeCompare(rightDue);
  }

  return left.title.localeCompare(right.title);
};

export const formatDueDateChip = (
  dueDate: string | null | undefined,
  now: Date = new Date()
): string => {
  if (!dueDate) return "";
  if (isOverdueDate(dueDate, now)) return "Overdue";
  if (isDueToday(dueDate, now)) return "Due today";
  if (isDueThisWeek(dueDate, now)) return "Due this week";

  const parsed = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dueDate;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const CARD_TYPE_COLORS: Record<CardType, string> = {
  initiative: "#753991",
  epic: "#209dd7",
  task: "#38a169",
  story: "#ecad0a",
  change_scope: "#e53e3e",
  sub_task: "#888888",
};

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  initiative: "Initiative",
  epic: "Epic",
  task: "Task",
  story: "Story",
  change_scope: "Change Scope",
  sub_task: "Sub-task",
};

export const CARD_TYPE_PREFIXES: Record<CardType, string> = {
  initiative: "INIT",
  epic: "EPIC",
  task: "TASK",
  story: "STORY",
  change_scope: "CS",
  sub_task: "ST",
};

export const ALLOWED_CHILD_TYPES: Record<CardType, CardType[]> = {
  initiative: ["epic"],
  epic: ["task", "story", "change_scope"],
  task: ["sub_task"],
  story: ["sub_task"],
  change_scope: ["sub_task"],
  sub_task: [],
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

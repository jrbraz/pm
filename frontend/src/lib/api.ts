import type { BoardData, BoardSummary } from "@/lib/kanban";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  reply: string;
  board_updated: boolean;
};

type BoardPayload = {
  username: string;
  board: BoardData;
};

type NamedBoardPayload = {
  id: number;
  name: string;
  username: string;
  board: BoardData;
  is_default: boolean;
};

type BoardListPayload = {
  username: string;
  boards: BoardSummary[];
};

export type AuthResponse = {
  token: string;
  username: string;
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as {
      error?: { message?: string };
    };
    return data.error?.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export const loginUser = async (username: string, password: string): Promise<AuthResponse> => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as AuthResponse;
};

export const registerUser = async (username: string, password: string): Promise<AuthResponse> => {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  // After registration, log in
  return loginUser(username, password);
};

export const logoutUser = async (token: string): Promise<void> => {
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
};

// ---------------------------------------------------------------------------
// Board list API
// ---------------------------------------------------------------------------

export const listBoards = async (username: string): Promise<BoardSummary[]> => {
  const response = await fetch(`/api/users/${encodeURIComponent(username)}/boards`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as BoardListPayload;
  return data.boards;
};

export const createBoard = async (username: string, name: string): Promise<NamedBoardPayload> => {
  const response = await fetch(`/api/users/${encodeURIComponent(username)}/boards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as NamedBoardPayload;
};

export const deleteBoard = async (username: string, boardId: number): Promise<void> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}`,
    { method: "DELETE" }
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(await parseErrorMessage(response));
  }
};

export const renameBoard = async (
  username: string,
  boardId: number,
  name: string
): Promise<void> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
};

// ---------------------------------------------------------------------------
// Named board (specific board) API
// ---------------------------------------------------------------------------

export const fetchNamedBoard = async (
  username: string,
  boardId: number
): Promise<NamedBoardPayload> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as NamedBoardPayload;
};

export const saveNamedBoard = async (
  username: string,
  boardId: number,
  board: BoardData
): Promise<NamedBoardPayload> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(board),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as NamedBoardPayload;
};

// ---------------------------------------------------------------------------
// Legacy single-board API (kept for backward compat)
// ---------------------------------------------------------------------------

const boardEndpoint = (username: string) =>
  `/api/users/${encodeURIComponent(username)}/board`;

const chatEndpoint = (username: string) =>
  `/api/users/${encodeURIComponent(username)}/chat`;

export const fetchBoard = async (username: string): Promise<BoardData> => {
  const response = await fetch(boardEndpoint(username), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as BoardPayload;
  return data.board;
};

export const saveBoard = async (
  username: string,
  board: BoardData
): Promise<BoardData> => {
  const response = await fetch(boardEndpoint(username), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as BoardPayload;
  return data.board;
};

export const sendChat = async (
  username: string,
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> => {
  const response = await fetch(chatEndpoint(username), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ChatResponse;
};

export type BoardStats = {
  total_cards: number;
  total_columns: number;
  by_priority: Record<string, number>;
  overdue: number;
  has_due_date: number;
  by_column: Record<string, number>;
};

export const fetchBoardStats = async (
  username: string,
  boardId: number
): Promise<BoardStats> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/stats`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as BoardStats;
};

export const sendChatForBoard = async (
  username: string,
  boardId: number,
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ChatResponse;
};

import type {
  ActivityEntry,
  BoardData,
  BoardMember,
  BoardSummary,
  Comment,
  DashboardData,
} from "@/lib/kanban";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  reply: string;
  board_updated: boolean;
};

export type NamedBoardPayload = {
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

export type BoardStats = {
  total_cards: number;
  total_columns: number;
  by_priority: Record<string, number>;
  overdue: number;
  has_due_date: number;
  by_column: Record<string, number>;
  checklist_items: number;
  checklist_done: number;
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  if (response.status === 401 && typeof window !== "undefined") {
    window.localStorage.removeItem("pm-token");
    window.localStorage.removeItem("pm-username");
    window.location.reload();
  }
  try {
    const data = (await response.json()) as {
      error?: { message?: string };
    };
    return data.error?.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

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
  return loginUser(username, password);
};

export const logoutUser = async (token: string): Promise<void> => {
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: authHeader(token),
  });
};

// ---------------------------------------------------------------------------
// Board list API
// ---------------------------------------------------------------------------

export const listBoards = async (username: string, token?: string): Promise<BoardSummary[]> => {
  const response = await fetch(`/api/users/${encodeURIComponent(username)}/boards`, {
    cache: "no-store",
    headers: token ? authHeader(token) : {},
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as BoardListPayload;
  return data.boards;
};

export const createBoard = async (
  username: string,
  name: string,
  token?: string
): Promise<NamedBoardPayload> => {
  const response = await fetch(`/api/users/${encodeURIComponent(username)}/boards`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? authHeader(token) : {}) },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as NamedBoardPayload;
};

export const duplicateBoard = async (
  username: string,
  boardId: number,
  name: string,
  token?: string
): Promise<NamedBoardPayload> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/duplicate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? authHeader(token) : {}) },
      body: JSON.stringify({ name }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as NamedBoardPayload;
};

export const deleteBoard = async (
  username: string,
  boardId: number,
  token?: string
): Promise<void> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}`,
    {
      method: "DELETE",
      headers: token ? authHeader(token) : {},
    }
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(await parseErrorMessage(response));
  }
};

export const renameBoard = async (
  username: string,
  boardId: number,
  name: string,
  token?: string
): Promise<void> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? authHeader(token) : {}) },
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
  boardId: number,
  token?: string
): Promise<NamedBoardPayload> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}`,
    { cache: "no-store", headers: token ? authHeader(token) : {} }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as NamedBoardPayload;
};

export const saveNamedBoard = async (
  username: string,
  boardId: number,
  board: BoardData,
  token?: string
): Promise<NamedBoardPayload> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(token ? authHeader(token) : {}) },
      body: JSON.stringify(board),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as NamedBoardPayload;
};

export const reserveNextCardId = async (
  username: string,
  token: string,
  cardType: string = "initiative"
): Promise<string> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/next-card-id`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ card_type: cardType }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as { card_id: string };
  return data.card_id;
};

export const fetchBoardStats = async (
  username: string,
  boardId: number,
  token?: string
): Promise<BoardStats> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/stats`,
    { cache: "no-store", headers: token ? authHeader(token) : {} }
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
  history: ChatMessage[],
  token?: string
): Promise<ChatResponse> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? authHeader(token) : {}) },
      body: JSON.stringify({ message, history }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as ChatResponse;
};

// ---------------------------------------------------------------------------
// Board members API
// ---------------------------------------------------------------------------

export const fetchBoardMembers = async (
  username: string,
  boardId: number,
  token: string
): Promise<{ members: BoardMember[]; owner_user_id: number }> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/members`,
    { headers: authHeader(token) }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as { members: BoardMember[]; owner_user_id: number };
};

export const inviteMember = async (
  username: string,
  boardId: number,
  inviteUsername: string,
  role: "member" | "viewer",
  token: string
): Promise<{ username: string; role: string }> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/members`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ username: inviteUsername, role }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as { username: string; role: string };
};

export const updateMemberRole = async (
  username: string,
  boardId: number,
  memberUsername: string,
  role: "member" | "viewer",
  token: string
): Promise<void> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/members/${encodeURIComponent(memberUsername)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ role }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
};

export const removeMember = async (
  username: string,
  boardId: number,
  memberUsername: string,
  token: string
): Promise<void> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/members/${encodeURIComponent(memberUsername)}`,
    { method: "DELETE", headers: authHeader(token) }
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(await parseErrorMessage(response));
  }
};

// ---------------------------------------------------------------------------
// Comments API
// ---------------------------------------------------------------------------

export const fetchComments = async (
  username: string,
  boardId: number,
  cardId: string,
  token: string
): Promise<Comment[]> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/cards/${encodeURIComponent(cardId)}/comments`,
    { headers: authHeader(token) }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as { comments: Comment[] };
  return data.comments;
};

export const createComment = async (
  username: string,
  boardId: number,
  cardId: string,
  body: string,
  token: string
): Promise<Comment> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/cards/${encodeURIComponent(cardId)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ body }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as Comment;
};

export const updateComment = async (
  username: string,
  boardId: number,
  cardId: string,
  commentId: number,
  body: string,
  token: string
): Promise<Comment> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/cards/${encodeURIComponent(cardId)}/comments/${commentId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ body }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as Comment;
};

export const deleteComment = async (
  username: string,
  boardId: number,
  cardId: string,
  commentId: number,
  token: string
): Promise<void> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/cards/${encodeURIComponent(cardId)}/comments/${commentId}`,
    { method: "DELETE", headers: authHeader(token) }
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(await parseErrorMessage(response));
  }
};

// ---------------------------------------------------------------------------
// Activity API
// ---------------------------------------------------------------------------

export const fetchBoardActivity = async (
  username: string,
  boardId: number,
  token: string,
  options?: { limit?: number; offset?: number; cardId?: string }
): Promise<ActivityEntry[]> => {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));
  if (options?.cardId) params.set("card_id", options.cardId);

  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/boards/${boardId}/activity${params.size ? `?${params}` : ""}`,
    { headers: authHeader(token) }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as { activity: ActivityEntry[] };
  return data.activity;
};

// ---------------------------------------------------------------------------
// Dashboard API
// ---------------------------------------------------------------------------

export const fetchDashboard = async (
  username: string,
  token: string
): Promise<DashboardData> => {
  const response = await fetch(
    `/api/users/${encodeURIComponent(username)}/dashboard`,
    { headers: authHeader(token) }
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as DashboardData;
};

// ---------------------------------------------------------------------------
// User search API
// ---------------------------------------------------------------------------

export const searchUsers = async (
  query: string,
  token: string
): Promise<Array<{ id: number; username: string }>> => {
  const response = await fetch(
    `/api/users/search?q=${encodeURIComponent(query)}`,
    { headers: authHeader(token) }
  );
  if (!response.ok) {
    return [];
  }
  return (await response.json()) as Array<{ id: number; username: string }>;
};

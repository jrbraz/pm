import type { BoardData } from "@/lib/kanban";

type BoardPayload = {
  username: string;
  board: BoardData;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  reply: string;
  board_updated: boolean;
};

const boardEndpoint = (username: string) =>
  `/api/users/${encodeURIComponent(username)}/board`;

const chatEndpoint = (username: string) =>
  `/api/users/${encodeURIComponent(username)}/chat`;

const parseErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as {
      error?: { message?: string };
    };
    return data.error?.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

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
    headers: {
      "Content-Type": "application/json",
    },
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

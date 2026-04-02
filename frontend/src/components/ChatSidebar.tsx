"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { sendChatForBoard, type ChatMessage } from "@/lib/api";
import { useAuth } from "@/components/AuthContext";

type DisplayMessage = ChatMessage & { id: string };

let nextMsgId = 0;
const msgId = () => `msg-${++nextMsgId}`;

const SUGGESTED_PROMPTS = [
  "Create a new card in Backlog",
  "Move all high priority cards to In Progress",
  "Summarize the board status",
  "What cards are overdue?",
  "Add a 'bug' label to all cards without labels",
];

/**
 * Renders AI text with basic formatting: line breaks, bullet lists,
 * bold (**text**), and inline code (`text`).
 */
const FormattedMessage = ({ text }: { text: string }) => {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={key++} className="my-1.5 ml-3 list-disc space-y-0.5 pl-2">
        {listItems.map((item, i) => (
          <li key={i}>{formatInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
    } else {
      flushList();
      if (trimmed === "") {
        elements.push(<div key={key++} className="h-2" />);
      } else {
        elements.push(<p key={key++}>{formatInline(trimmed)}</p>);
      }
    }
  }
  flushList();

  return <>{elements}</>;
};

/** Format inline bold (**text**) and code (`text`). */
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let i = 0;

  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(remaining.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // Bold
      parts.push(<strong key={i++} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      // Inline code
      parts.push(
        <code key={i++} className="rounded bg-[var(--stroke)] px-1 py-0.5 text-[11px]">
          {match[3]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < remaining.length) {
    parts.push(remaining.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

type ChatSidebarProps = {
  username: string;
  boardId?: number | null;
  onBoardUpdated: () => void;
};

export const ChatSidebar = ({ username, boardId, onBoardUpdated }: ChatSidebarProps) => {
  const { token } = useAuth();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isSending) return;

      const userMessage: DisplayMessage = { id: msgId(), role: "user", content: trimmed };
      const updatedHistory = [...messages, userMessage];
      setMessages(updatedHistory);
      setInput("");
      setIsSending(true);
      setError(null);

      try {
        if (boardId == null) {
          throw new Error("No board selected.");
        }
        const response = await sendChatForBoard(username, boardId, trimmed, messages, token || undefined);
        const assistantMessage: DisplayMessage = {
          id: msgId(),
          role: "assistant",
          content: response.reply,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        if (response.board_updated) {
          onBoardUpdated();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get a response. Please try again.");
      } finally {
        setIsSending(false);
      }
    },
    [input, isSending, messages, username, boardId, onBoardUpdated]
  );

  const handleSuggestionClick = useCallback(
    (prompt: string) => {
      if (isSending) return;
      setInput(prompt);
      // Submit programmatically by setting input then triggering send
      const userMessage: DisplayMessage = { id: msgId(), role: "user", content: prompt };
      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);
      setError(null);

      if (boardId == null) {
        setError("No board selected.");
        setIsSending(false);
        return;
      }

      void sendChatForBoard(username, boardId, prompt, messages, token || undefined)
        .then((response) => {
          const assistantMessage: DisplayMessage = {
            id: msgId(),
            role: "assistant",
            content: response.reply,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          if (response.board_updated) {
            onBoardUpdated();
          }
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to get a response. Please try again.");
        })
        .finally(() => {
          setIsSending(false);
        });
    },
    [isSending, messages, username, boardId, token, onBoardUpdated]
  );

  return (
    <aside
      className="flex h-full flex-col rounded-[28px] border border-[var(--stroke)] bg-white/90 shadow-[var(--shadow)] backdrop-blur"
      data-testid="chat-sidebar"
    >
      <div className="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--gray-text)]">
            AI Assistant
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--navy-dark)]">Chat with your board</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setInput("");
              setError(null);
            }}
            className="rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
            title="Clear chat"
            data-testid="chat-clear"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" data-testid="chat-messages">
        {messages.length === 0 && !isSending ? (
          <div className="py-6" data-testid="chat-suggestions">
            <p className="mb-4 text-center text-xs text-[var(--gray-text)]">
              Ask the AI to manage your board, or try a suggestion:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSuggestionClick(prompt)}
                  className="rounded-xl border border-[var(--stroke)] bg-white px-3 py-1.5 text-xs text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div
                className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--secondary-purple)]"
                aria-hidden="true"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="white">
                  <path d="M6 12.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-8a.5.5 0 0 0-.5.5v2a.5.5 0 0 1-1 0v-2A1.5 1.5 0 0 1 6.5 2h8A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 5 12.5v-2a.5.5 0 0 1 1 0v2z" />
                  <path d="M10.828 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L9.293 7.5H1.5a.5.5 0 0 0 0 1h7.793l-2.173 2.146a.5.5 0 1 0 .708.708l3-3z" />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--secondary-purple)] text-white"
                  : "border border-[var(--stroke)] bg-white text-[var(--navy-dark)] shadow-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <FormattedMessage text={msg.content} />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {isSending ? (
          <div className="mb-3 flex justify-start">
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--gray-text)]">
              Thinking...
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {error ? (
        <p className="mx-4 mb-2 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-medium text-[var(--secondary-purple)]">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSend} className="border-t border-[var(--stroke)] px-4 py-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the AI..."
            disabled={isSending}
            className="flex-1 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition placeholder:text-[var(--gray-text)] focus:border-[var(--primary-blue)] disabled:opacity-50"
            data-testid="chat-input"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--secondary-purple)] p-2.5 text-white transition hover:brightness-110 disabled:opacity-50"
            data-testid="chat-send"
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M14 8H2M8 2l6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </form>
    </aside>
  );
};

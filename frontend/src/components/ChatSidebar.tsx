"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { sendChat, type ChatMessage } from "@/lib/api";

type DisplayMessage = ChatMessage & { id: string };

let nextMsgId = 0;
const msgId = () => `msg-${++nextMsgId}`;

type ChatSidebarProps = {
  username: string;
  onBoardUpdated: () => void;
};

export const ChatSidebar = ({ username, onBoardUpdated }: ChatSidebarProps) => {
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
        const response = await sendChat(username, trimmed, messages);
        const assistantMessage: DisplayMessage = {
          id: msgId(),
          role: "assistant",
          content: response.reply,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        if (response.board_updated) {
          onBoardUpdated();
        }
      } catch {
        setError("Failed to get a response. Please try again.");
      } finally {
        setIsSending(false);
      }
    },
    [input, isSending, messages, username, onBoardUpdated]
  );

  return (
    <aside
      className="flex h-full flex-col rounded-[28px] border border-[var(--stroke)] bg-white/90 shadow-[var(--shadow)] backdrop-blur"
      data-testid="chat-sidebar"
    >
      <div className="border-b border-[var(--stroke)] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--gray-text)]">
          AI Assistant
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--navy-dark)]">
          Chat with your board
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" data-testid="chat-messages">
        {messages.length === 0 && !isSending ? (
          <p className="py-8 text-center text-xs text-[var(--gray-text)]">
            Ask the AI to create, edit, move, or delete cards on your board.
          </p>
        ) : null}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--secondary-purple)] text-white"
                  : "border border-[var(--stroke)] bg-[var(--surface)] text-[var(--navy-dark)]"
              }`}
            >
              {msg.content}
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

      <form
        onSubmit={handleSend}
        className="border-t border-[var(--stroke)] px-4 py-3"
      >
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
            className="rounded-xl bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:brightness-110 disabled:opacity-50"
            data-testid="chat-send"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
};

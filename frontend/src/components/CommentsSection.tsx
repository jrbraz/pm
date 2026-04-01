"use client";

import { useEffect, useRef, useState } from "react";
import { createComment, deleteComment, fetchComments, updateComment } from "@/lib/api";
import { formatRelativeTime, type Comment } from "@/lib/kanban";
import { useAuth } from "@/components/AuthContext";

type CommentsSectionProps = {
  username: string;
  boardId: number;
  cardId: string;
};

export const CommentsSection = ({ username, boardId, cardId }: CommentsSectionProps) => {
  const { token, username: currentUser } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newBody, setNewBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchComments(username, boardId, cardId, token)
      .then((data) => { if (!cancelled) setComments(data); })
      .catch(() => { if (!cancelled) setError("Failed to load comments."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [username, boardId, cardId, token]);

  const handleSubmit = async () => {
    const body = newBody.trim();
    if (!body || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const comment = await createComment(username, boardId, cardId, body, token);
      setComments((prev) => [...prev, comment]);
      setNewBody("");
    } catch {
      setError("Failed to post comment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
  };

  const handleSaveEdit = async (commentId: number) => {
    const body = editBody.trim();
    if (!body) return;
    try {
      const updated = await updateComment(username, boardId, cardId, commentId, body, token);
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingId(null);
    } catch {
      setError("Failed to update comment.");
    }
  };

  const handleDelete = async (commentId: number) => {
    try {
      await deleteComment(username, boardId, cardId, commentId, token);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      setError("Failed to delete comment.");
    }
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-xs text-[var(--gray-text)]">Loading comments...</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="group">
              <div className="flex items-start gap-2">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ backgroundColor: "var(--primary-blue)" }}
                >
                  {comment.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-[var(--navy-dark)]">
                      {comment.username}
                    </span>
                    <span className="text-[10px] text-[var(--gray-text)]">
                      {formatRelativeTime(comment.created_at)}
                      {comment.updated_at !== comment.created_at && " (edited)"}
                    </span>
                  </div>
                  {editingId === comment.id ? (
                    <div className="mt-1 space-y-1">
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-[var(--primary-blue)] bg-white px-2 py-1.5 text-xs text-[var(--navy-dark)] outline-none"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(comment.id)}
                          className="rounded-md bg-[var(--primary-blue)] px-2.5 py-1 text-[10px] font-semibold text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-md border border-[var(--stroke)] px-2.5 py-1 text-[10px] font-semibold text-[var(--gray-text)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-xs leading-5 text-[var(--navy-dark)]">
                      {comment.body}
                    </p>
                  )}
                </div>
                {editingId !== comment.id && comment.username === currentUser && (
                  <div className="hidden shrink-0 gap-1 group-hover:flex">
                    <button
                      type="button"
                      onClick={() => handleEdit(comment)}
                      className="text-[var(--gray-text)] hover:text-[var(--primary-blue)]"
                      title="Edit"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(comment.id)}
                      className="text-[var(--gray-text)] hover:text-red-500"
                      title="Delete"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                        <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
          {comments.length === 0 && (
            <p className="text-xs text-[var(--gray-text)]">No comments yet.</p>
          )}
        </ul>
      )}

      {error && (
        <p className="text-xs text-[var(--secondary-purple)]">{error}</p>
      )}

      <div className="border-t border-[var(--stroke)] pt-3">
        <textarea
          ref={textareaRef}
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-xs text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <div className="mt-1.5 flex justify-end">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!newBody.trim() || isSubmitting}
            className="rounded-full bg-[var(--primary-blue)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {isSubmitting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
};

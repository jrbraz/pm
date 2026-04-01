"use client";

import { useEffect, useRef, useState } from "react";
import { fetchBoardMembers, inviteMember, removeMember, updateMemberRole } from "@/lib/api";
import { type BoardMember } from "@/lib/kanban";
import { useAuth } from "@/components/AuthContext";

type BoardSettingsPanelProps = {
  username: string;
  boardId: number;
  boardName: string;
  onClose: () => void;
};

export const BoardSettingsPanel = ({
  username,
  boardId,
  boardName,
  onClose,
}: BoardSettingsPanelProps) => {
  const { token, username: currentUser } = useAuth();
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [ownerUserId, setOwnerUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "viewer">("member");
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const loadMembers = () => {
    setIsLoading(true);
    fetchBoardMembers(username, boardId, token)
      .then(({ members: m, owner_user_id }) => {
        setMembers(m);
        setOwnerUserId(owner_user_id);
      })
      .catch(() => setError("Failed to load members."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadMembers(); }, [username, boardId, token]);

  const isOwner = members.length === 0
    ? true // optimistic while loading
    : ownerUserId != null && members.find((m) => m.username === currentUser) === undefined;

  const handleInvite = async () => {
    const u = inviteUsername.trim();
    if (!u || isInviting) return;
    setIsInviting(true);
    setError(null);
    try {
      await inviteMember(username, boardId, u, inviteRole, token);
      setInviteUsername("");
      loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite user.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (memberUsername: string, role: "member" | "viewer") => {
    try {
      await updateMemberRole(username, boardId, memberUsername, role, token);
      setMembers((prev) =>
        prev.map((m) => (m.username === memberUsername ? { ...m, role } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role.");
    }
  };

  const handleRemove = async (memberUsername: string) => {
    try {
      await removeMember(username, boardId, memberUsername, token);
      setMembers((prev) => prev.filter((m) => m.username !== memberUsername));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-[2px]">
      <div
        ref={panelRef}
        className="flex h-full w-full max-w-sm flex-col border-l border-[var(--stroke)] bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Board Settings
            </p>
            <h2 className="mt-1 font-display text-base font-semibold text-[var(--navy-dark)]">
              {boardName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Members section */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Members
            </p>

            {/* Owner row */}
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--secondary-purple)] text-[9px] font-bold text-white">
                {username.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--navy-dark)] truncate">{username}</p>
                <p className="text-[10px] text-[var(--gray-text)]">Owner</p>
              </div>
            </div>

            {isLoading ? (
              <p className="text-xs text-[var(--gray-text)]">Loading...</p>
            ) : (
              <ul className="space-y-1.5">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary-blue)] text-[9px] font-bold text-white">
                      {member.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--navy-dark)] truncate">
                        {member.username}
                      </p>
                      <p className="text-[10px] text-[var(--gray-text)]">
                        Invited by {member.invited_by ?? username}
                      </p>
                    </div>
                    <select
                      value={member.role}
                      onChange={(e) => void handleRoleChange(member.username, e.target.value as "member" | "viewer")}
                      className="rounded-lg border border-[var(--stroke)] bg-white px-1.5 py-1 text-[10px] font-semibold text-[var(--navy-dark)] outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleRemove(member.username)}
                      className="text-[var(--gray-text)] transition hover:text-red-500"
                      title="Remove member"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                      </svg>
                    </button>
                  </li>
                ))}
                {members.length === 0 && (
                  <p className="text-xs text-[var(--gray-text)]">No members yet. Invite someone below.</p>
                )}
              </ul>
            )}
          </div>

          {/* Invite form */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Invite Member
            </p>
            <div className="space-y-2">
              <input
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); }}
                placeholder="Username"
                className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-xs text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              />
              <div className="flex gap-2">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "member" | "viewer")}
                  className="flex-1 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-xs text-[var(--navy-dark)] outline-none"
                >
                  <option value="member">Member (can edit)</option>
                  <option value="viewer">Viewer (read-only)</option>
                </select>
                <button
                  type="button"
                  onClick={() => void handleInvite()}
                  disabled={!inviteUsername.trim() || isInviting}
                  className="rounded-xl bg-[var(--primary-blue)] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {isInviting ? "..." : "Invite"}
                </button>
              </div>
            </div>

            {error && (
              <p className="mt-2 text-xs text-[var(--secondary-purple)]">{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

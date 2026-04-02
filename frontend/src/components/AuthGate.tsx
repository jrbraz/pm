"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AuthContext } from "@/components/AuthContext";
import { ChatSidebar } from "@/components/ChatSidebar";
import { DashboardPage } from "@/components/DashboardPage";
import { KanbanBoard } from "@/components/KanbanBoard";
import { BoardSelector } from "@/components/BoardSelector";
import { loginUser, registerUser, logoutUser } from "@/lib/api";

const TOKEN_KEY = "pm-token";
const USERNAME_KEY = "pm-username";

type AuthMode = "login" | "register";

export const AuthGate = () => {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    const storedUsername = window.localStorage.getItem(USERNAME_KEY);
    if (storedToken && storedUsername) {
      setToken(storedToken);
      setUsername(storedUsername);
    }
  }, []);

  const handleBoardUpdated = useCallback(() => {
    setRefreshSignal((n) => n + 1);
  }, []);

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const result =
        authMode === "login"
          ? await loginUser(formUsername, formPassword)
          : await registerUser(formUsername, formPassword);
      window.localStorage.setItem(TOKEN_KEY, result.token);
      window.localStorage.setItem(USERNAME_KEY, result.username);
      setToken(result.token);
      setUsername(result.username);
      setFormPassword("");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      await logoutUser(token).catch(() => {});
    }
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USERNAME_KEY);
    setToken(null);
    setUsername("");
    setActiveBoardId(null);
    setFormUsername("");
    setFormPassword("");
  };

  if (!token) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--surface)] px-6 py-12">
        <div className="pointer-events-none absolute left-0 top-0 h-[380px] w-[380px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[460px] w-[460px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.2)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

        <section className="relative w-full max-w-md rounded-[28px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--gray-text)]">
            {authMode === "login" ? "Sign in" : "Create account"}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            Project Workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
            {authMode === "login"
              ? "Sign in to access your boards."
              : "Create an account to get started."}
          </p>

          <form onSubmit={(e) => void handleAuth(e)} className="mt-6 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Username
              <input
                value={formUsername}
                onChange={(event) => setFormUsername(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                autoComplete="username"
                required
                minLength={2}
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Password
              <input
                type="password"
                value={formPassword}
                onChange={(event) => setFormPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                required
                minLength={4}
              />
            </label>

            {errorMessage ? (
              <p className="text-sm font-medium text-[var(--secondary-purple)]">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {isSubmitting
                ? "Please wait..."
                : authMode === "login"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-[var(--gray-text)]">
            {authMode === "login" ? (
              <>
                No account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setErrorMessage("");
                  }}
                  className="font-semibold text-[var(--primary-blue)] hover:underline"
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setErrorMessage("");
                  }}
                  className="font-semibold text-[var(--primary-blue)] hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </section>
      </main>
    );
  }

  return (
    <AuthContext.Provider value={{ token, username }}>
      <div className="flex h-screen overflow-hidden">
        {/* Left sidebar: board list */}
        {showLeftPanel && (
          <aside className="flex w-52 shrink-0 flex-col overflow-y-auto border-r border-[var(--stroke)] bg-white px-2 py-4">
            <div className="mb-4 flex items-center justify-between px-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
                  Workspace
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--navy-dark)]">
                  {username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLeftPanel(false)}
                className="rounded-lg p-1 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
                title="Hide sidebar"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z" />
                </svg>
              </button>
            </div>

            {/* Dashboard link */}
            <button
              type="button"
              onClick={() => setActiveBoardId(null)}
              className={`mb-2 w-full rounded-xl px-2 py-1.5 text-left text-xs font-semibold transition ${
                activeBoardId === null
                  ? "bg-[var(--surface)] text-[var(--navy-dark)]"
                  : "text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
              }`}
            >
              Dashboard
            </button>

            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Boards
            </p>
            <BoardSelector
              username={username}
              activeBoardId={activeBoardId}
              onSelectBoard={setActiveBoardId}
            />

            <div className="mt-auto border-t border-[var(--stroke)] px-2 pt-3 pb-2">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--surface)] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] transition hover:bg-red-50 hover:text-red-500"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 12.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-8a.5.5 0 0 0-.5.5v2a.5.5 0 0 1-1 0v-2A1.5 1.5 0 0 1 6.5 2h8A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 5 12.5v-2a.5.5 0 0 1 1 0v2z"/>
                  <path d="M.146 8.354a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L1.707 7.5H10.5a.5.5 0 0 1 0 1H1.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3z"/>
                </svg>
                Log out
              </button>
            </div>
          </aside>
        )}

        {/* Board area */}
        <div className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          {/* Toggle buttons for collapsed panels */}
          <div className="absolute left-2 top-2 z-10 flex gap-1">
            {!showLeftPanel && (
              <button
                type="button"
                onClick={() => setShowLeftPanel(true)}
                className="rounded-xl border border-[var(--stroke)] bg-white p-2 text-[var(--gray-text)] shadow-sm transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                title="Show workspace"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
                </svg>
              </button>
            )}
          </div>
          <div className="absolute right-2 top-2 z-10 flex gap-1">
            {!showRightPanel && (
              <button
                type="button"
                onClick={() => setShowRightPanel(true)}
                className="rounded-xl border border-[var(--stroke)] bg-white p-2 text-[var(--gray-text)] shadow-sm transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
                title="Show AI assistant"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.678 11.894a1 1 0 0 1 .287.801 10.97 10.97 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8.06 8.06 0 0 0 8 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105z" />
                </svg>
              </button>
            )}
          </div>

          {activeBoardId !== null ? (
            <KanbanBoard
              username={username}
              boardId={activeBoardId}
              refreshSignal={refreshSignal}
            />
          ) : (
            <DashboardPage onSelectBoard={setActiveBoardId} />
          )}
        </div>

        {/* Chat sidebar */}
        {showRightPanel && (
          <div className="relative h-full w-[340px] shrink-0 p-4">
            <button
              type="button"
              onClick={() => setShowRightPanel(false)}
              className="absolute right-6 top-6 z-10 rounded-lg p-1 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
              title="Hide AI assistant"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </button>
            <ChatSidebar
              username={username}
              boardId={activeBoardId}
              onBoardUpdated={handleBoardUpdated}
            />
          </div>
        )}
      </div>
    </AuthContext.Provider>
  );
};

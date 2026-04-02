"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
          <section className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-white p-8 text-center shadow-[var(--shadow)]">
            <h1 className="font-display text-2xl font-semibold text-[var(--navy-dark)]">
              Something went wrong
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
              An unexpected error occurred. Please reload the page.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110"
            >
              Reload
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

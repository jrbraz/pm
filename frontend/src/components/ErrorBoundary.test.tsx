import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const ThrowingChild = () => {
  throw new Error("Test explosion");
};

const GoodChild = () => <p>All good</p>;

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Suppress React error boundary console.error noise
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders fallback UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
  });

  it("does not render children after error", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.queryByText("Test explosion")).not.toBeInTheDocument();
  });
});

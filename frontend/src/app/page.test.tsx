import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

vi.mock("@/components/AuthGate", () => ({
  AuthGate: () => <div data-testid="auth-gate">Auth gate</div>,
}));

describe("Home page", () => {
  it("renders the auth gate component", () => {
    render(<Home />);
    expect(screen.getByTestId("auth-gate")).toBeInTheDocument();
  });
});

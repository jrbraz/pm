import type { ReactElement } from "react";

vi.mock("next/font/google", () => ({
  Manrope: () => ({ variable: "body-font" }),
  Space_Grotesk: () => ({ variable: "display-font" }),
}));

import RootLayout, { metadata } from "@/app/layout";

describe("RootLayout", () => {
  it("exports expected metadata", () => {
    expect(metadata.title).toBe("Kanban Studio");
  });

  it("wraps children inside html/body", () => {
    const result = RootLayout({
      children: <span data-testid="child">Child</span>,
    }) as ReactElement;

    expect(result.type).toBe("html");
    const body = result.props.children as ReactElement;
    expect(body.type).toBe("body");
  });
});

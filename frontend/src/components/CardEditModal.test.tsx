import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardEditModal } from "@/components/CardEditModal";
import type { Card } from "@/lib/kanban";

const testCard: Card = {
  id: "card-1",
  title: "Fix login bug",
  details: "The login form breaks on mobile",
  priority: "high",
  labels: ["bug", "auth"],
  due_date: "2026-05-01",
};

describe("CardEditModal", () => {
  it("renders with card data pre-filled", () => {
    render(
      <CardEditModal
        card={testCard}
        columnTitle="In Progress"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("Fix login bug")).toBeInTheDocument();
    expect(screen.getByDisplayValue("The login form breaks on mobile")).toBeInTheDocument();
    expect(screen.getByDisplayValue("bug, auth")).toBeInTheDocument();
  });

  it("calls onSave with updated card data", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <CardEditModal
        card={testCard}
        columnTitle="In Progress"
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    const titleInput = screen.getByDisplayValue("Fix login bug");
    await user.clear(titleInput);
    await user.type(titleInput, "Fixed login bug");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "card-1",
        title: "Fixed login bug",
      })
    );
  });

  it("calls onClose when cancel is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <CardEditModal
        card={testCard}
        columnTitle="In Progress"
        onSave={vi.fn()}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(
      <CardEditModal
        card={testCard}
        columnTitle="In Progress"
        onSave={vi.fn()}
        onClose={onClose}
      />
    );

    // Click the backdrop (the fixed overlay div)
    const backdrop = document.querySelector('[class*="fixed inset-0"]');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <CardEditModal
        card={testCard}
        columnTitle="In Progress"
        onSave={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("can change priority to critical", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <CardEditModal
        card={testCard}
        columnTitle="Review"
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /critical/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "critical" })
    );
  });

  it("can clear priority", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <CardEditModal
        card={testCard}
        columnTitle="Backlog"
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /^none$/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ priority: null })
    );
  });

  it("does not save when title is empty", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <CardEditModal
        card={testCard}
        columnTitle="Todo"
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    const titleInput = screen.getByDisplayValue("Fix login bug");
    await user.clear(titleInput);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSave).not.toHaveBeenCalled();
  });
});

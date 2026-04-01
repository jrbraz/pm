import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChecklistSection } from "@/components/ChecklistSection";
import type { ChecklistItem } from "@/lib/kanban";

const makeItem = (id: string, text: string, done = false): ChecklistItem => ({ id, text, done });

describe("ChecklistSection", () => {
  it("renders empty state with add input", () => {
    render(<ChecklistSection items={[]} onChange={() => {}} />);
    expect(screen.getByPlaceholderText(/add an item/i)).toBeInTheDocument();
  });

  it("shows checklist items", () => {
    const items = [makeItem("1", "First item"), makeItem("2", "Second item", true)];
    render(<ChecklistSection items={items} onChange={() => {}} />);
    expect(screen.getByDisplayValue("First item")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Second item")).toBeInTheDocument();
  });

  it("shows progress bar with correct count", () => {
    const items = [
      makeItem("1", "Done", true),
      makeItem("2", "Pending", false),
      makeItem("3", "Done2", true),
    ];
    render(<ChecklistSection items={items} onChange={() => {}} />);
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("calls onChange when toggling item", async () => {
    const onChange = vi.fn();
    const items = [makeItem("1", "Task", false)];
    render(<ChecklistSection items={items} onChange={onChange} />);

    const checkButton = screen.getByLabelText(/mark complete/i);
    await userEvent.click(checkButton);

    expect(onChange).toHaveBeenCalledWith([{ id: "1", text: "Task", done: true }]);
  });

  it("calls onChange when adding new item", async () => {
    const onChange = vi.fn();
    render(<ChecklistSection items={[]} onChange={onChange} />);

    const input = screen.getByPlaceholderText(/add an item/i);
    await userEvent.type(input, "New task");
    await userEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(onChange).toHaveBeenCalled();
    const newItems = onChange.mock.calls[0][0] as ChecklistItem[];
    expect(newItems).toHaveLength(1);
    expect(newItems[0].text).toBe("New task");
    expect(newItems[0].done).toBe(false);
  });

  it("adds item on Enter key press", async () => {
    const onChange = vi.fn();
    render(<ChecklistSection items={[]} onChange={onChange} />);

    const input = screen.getByPlaceholderText(/add an item/i);
    await userEvent.type(input, "Enter task{Enter}");

    expect(onChange).toHaveBeenCalled();
  });

  it("does not add empty item", async () => {
    const onChange = vi.fn();
    render(<ChecklistSection items={[]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears input after adding item", async () => {
    render(<ChecklistSection items={[]} onChange={() => {}} />);
    const input = screen.getByPlaceholderText(/add an item/i);
    await userEvent.type(input, "Some task");
    await userEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(input).toHaveValue("");
  });

  it("disables Add button when input is empty", () => {
    render(<ChecklistSection items={[]} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /add/i })).toBeDisabled();
  });
});

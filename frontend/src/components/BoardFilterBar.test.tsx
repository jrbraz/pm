import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardFilterBar } from "@/components/BoardFilterBar";

const defaultProps = {
  searchQuery: "",
  onSearchChange: vi.fn(),
  filterPriority: null as null,
  onFilterPriorityChange: vi.fn(),
  filterDueDate: "all" as const,
  onFilterDueDateChange: vi.fn(),
  filterCardType: null as null,
  onFilterCardTypeChange: vi.fn(),
  filterLabel: "",
  onFilterLabelChange: vi.fn(),
  sortMode: "manual" as const,
  onSortModeChange: vi.fn(),
  allLabels: [] as string[],
  hasActiveFilter: false,
  onClearFilters: vi.fn(),
};

describe("BoardFilterBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders search input", () => {
    render(<BoardFilterBar {...defaultProps} />);
    expect(screen.getByPlaceholderText(/search cards/i)).toBeInTheDocument();
  });

  it("renders priority filter buttons", () => {
    render(<BoardFilterBar {...defaultProps} />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("renders due-date filter buttons", () => {
    render(<BoardFilterBar {...defaultProps} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("renders card type filter buttons", () => {
    render(<BoardFilterBar {...defaultProps} />);
    expect(screen.getByText("Initiative")).toBeInTheDocument();
    expect(screen.getByText("Epic")).toBeInTheDocument();
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("Story")).toBeInTheDocument();
    expect(screen.getByText("Change Scope")).toBeInTheDocument();
  });

  it("calls onSearchChange when typing", async () => {
    const onSearchChange = vi.fn();
    render(<BoardFilterBar {...defaultProps} onSearchChange={onSearchChange} />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/search cards/i), "a");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("calls onFilterPriorityChange when clicking priority", async () => {
    const onFilterPriorityChange = vi.fn();
    render(<BoardFilterBar {...defaultProps} onFilterPriorityChange={onFilterPriorityChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("High"));
    expect(onFilterPriorityChange).toHaveBeenCalledWith("high");
  });

  it("calls onFilterCardTypeChange when clicking type", async () => {
    const onFilterCardTypeChange = vi.fn();
    render(<BoardFilterBar {...defaultProps} onFilterCardTypeChange={onFilterCardTypeChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Epic"));
    expect(onFilterCardTypeChange).toHaveBeenCalledWith("epic");
  });

  it("shows label dropdown when labels exist", () => {
    render(<BoardFilterBar {...defaultProps} allLabels={["bug", "feature"]} />);
    expect(screen.getByText("All labels")).toBeInTheDocument();
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("feature")).toBeInTheDocument();
  });

  it("calls onFilterDueDateChange when clicking due-date filter", async () => {
    const onFilterDueDateChange = vi.fn();
    render(<BoardFilterBar {...defaultProps} onFilterDueDateChange={onFilterDueDateChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Today"));
    expect(onFilterDueDateChange).toHaveBeenCalledWith("today");
  });

  it("calls onSortModeChange when sort changes", async () => {
    const onSortModeChange = vi.fn();
    render(<BoardFilterBar {...defaultProps} onSortModeChange={onSortModeChange} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/card sort/i), "due-date");
    expect(onSortModeChange).toHaveBeenCalledWith("due-date");
  });

  it("shows Clear button when filter is active", () => {
    render(<BoardFilterBar {...defaultProps} hasActiveFilter={true} />);
    expect(screen.getByText("Clear all")).toBeInTheDocument();
  });

  it("does not show Clear button when no filter active", () => {
    render(<BoardFilterBar {...defaultProps} hasActiveFilter={false} />);
    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
  });

  it("calls onClearFilters when Clear is clicked", async () => {
    const onClearFilters = vi.fn();
    render(<BoardFilterBar {...defaultProps} hasActiveFilter={true} onClearFilters={onClearFilters} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Clear all"));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardFilterBar } from "@/components/BoardFilterBar";

const defaultProps = {
  searchQuery: "",
  onSearchChange: vi.fn(),
  filterPriority: null as null,
  onFilterPriorityChange: vi.fn(),
  filterLabel: "",
  onFilterLabelChange: vi.fn(),
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

  it("shows label dropdown when labels exist", () => {
    render(<BoardFilterBar {...defaultProps} allLabels={["bug", "feature"]} />);
    expect(screen.getByText("All labels")).toBeInTheDocument();
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("feature")).toBeInTheDocument();
  });

  it("shows Clear button when filter is active", () => {
    render(<BoardFilterBar {...defaultProps} hasActiveFilter={true} />);
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("does not show Clear button when no filter active", () => {
    render(<BoardFilterBar {...defaultProps} hasActiveFilter={false} />);
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  it("calls onClearFilters when Clear is clicked", async () => {
    const onClearFilters = vi.fn();
    render(<BoardFilterBar {...defaultProps} hasActiveFilter={true} onClearFilters={onClearFilters} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Clear"));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});

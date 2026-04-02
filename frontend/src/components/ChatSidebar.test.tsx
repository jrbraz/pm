import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";

vi.mock("@/lib/api", () => ({
  sendChatForBoard: vi.fn(),
}));

vi.mock("@/components/AuthContext", () => ({
  useAuth: () => ({ token: "test-token", username: "user" }),
}));

import { sendChatForBoard } from "@/lib/api";

const mockSendChat = vi.mocked(sendChatForBoard);

describe("ChatSidebar", () => {
  const onBoardUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state with placeholder text", () => {
    render(<ChatSidebar username="user" boardId={1} onBoardUpdated={onBoardUpdated} />);

    expect(screen.getByText(/ask the ai/i)).toBeInTheDocument();
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
    expect(screen.getByTestId("chat-send")).toBeDisabled();
  });

  it("sends a message and displays response", async () => {
    mockSendChat.mockResolvedValue({ reply: "Hello!", board_updated: false });
    const user = userEvent.setup();

    render(<ChatSidebar username="user" boardId={1} onBoardUpdated={onBoardUpdated} />);

    await user.type(screen.getByTestId("chat-input"), "hi there");
    await user.click(screen.getByTestId("chat-send"));

    expect(screen.getByText("hi there")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Hello!")).toBeInTheDocument();
    });

    expect(mockSendChat).toHaveBeenCalledWith("user", 1, "hi there", [], "test-token");
    expect(onBoardUpdated).not.toHaveBeenCalled();
  });

  it("calls onBoardUpdated when AI updates the board", async () => {
    mockSendChat.mockResolvedValue({ reply: "Card added.", board_updated: true });
    const user = userEvent.setup();

    render(<ChatSidebar username="user" boardId={1} onBoardUpdated={onBoardUpdated} />);

    await user.type(screen.getByTestId("chat-input"), "add a card");
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() => {
      expect(screen.getByText("Card added.")).toBeInTheDocument();
    });

    expect(onBoardUpdated).toHaveBeenCalledTimes(1);
  });

  it("shows error message on failure", async () => {
    mockSendChat.mockRejectedValue(new Error("AI request timed out. Please try again."));
    const user = userEvent.setup();

    render(<ChatSidebar username="user" boardId={1} onBoardUpdated={onBoardUpdated} />);

    await user.type(screen.getByTestId("chat-input"), "hello");
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() => {
      expect(screen.getByText(/AI request timed out/i)).toBeInTheDocument();
    });
  });

  it("disables send button while sending", async () => {
    let resolveChat: (value: { reply: string; board_updated: boolean }) => void;
    mockSendChat.mockImplementation(
      () => new Promise((resolve) => { resolveChat = resolve; })
    );
    const user = userEvent.setup();

    render(<ChatSidebar username="user" boardId={1} onBoardUpdated={onBoardUpdated} />);

    await user.type(screen.getByTestId("chat-input"), "test");
    await user.click(screen.getByTestId("chat-send"));

    expect(screen.getByText("Thinking...")).toBeInTheDocument();
    expect(screen.getByTestId("chat-send")).toBeDisabled();

    resolveChat!({ reply: "done", board_updated: false });

    await waitFor(() => {
      expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
    });
  });

  it("shows suggestion chips when chat is empty", () => {
    render(<ChatSidebar username="user" boardId={1} onBoardUpdated={onBoardUpdated} />);

    const suggestions = screen.getByTestId("chat-suggestions");
    expect(suggestions).toBeInTheDocument();
    expect(screen.getByText("Create a new card in Backlog")).toBeInTheDocument();
    expect(screen.getByText("Summarize the board status")).toBeInTheDocument();
    expect(screen.getByText("What cards are overdue?")).toBeInTheDocument();
  });

  it("hides suggestions after sending a message", async () => {
    mockSendChat.mockResolvedValue({ reply: "Done!", board_updated: false });
    const user = userEvent.setup();

    render(<ChatSidebar username="user" boardId={1} onBoardUpdated={onBoardUpdated} />);

    expect(screen.getByTestId("chat-suggestions")).toBeInTheDocument();

    await user.type(screen.getByTestId("chat-input"), "hello");
    await user.click(screen.getByTestId("chat-send"));

    expect(screen.queryByTestId("chat-suggestions")).not.toBeInTheDocument();
  });

  it("sends the prompt when clicking a suggestion chip", async () => {
    mockSendChat.mockResolvedValue({ reply: "Here are your overdue cards.", board_updated: false });

    render(<ChatSidebar username="user" boardId={1} onBoardUpdated={onBoardUpdated} />);

    const chip = screen.getByText("What cards are overdue?");
    await userEvent.click(chip);

    // The user message should appear
    expect(screen.getByText("What cards are overdue?")).toBeInTheDocument();
    // Suggestions should be hidden
    expect(screen.queryByTestId("chat-suggestions")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Here are your overdue cards.")).toBeInTheDocument();
    });

    expect(mockSendChat).toHaveBeenCalledWith(
      "user", 1, "What cards are overdue?", [], "test-token"
    );
  });

  it("calls onBoardUpdated when a suggestion triggers a board update", async () => {
    mockSendChat.mockResolvedValue({ reply: "Card created!", board_updated: true });

    render(<ChatSidebar username="user" boardId={1} onBoardUpdated={onBoardUpdated} />);

    await userEvent.click(screen.getByText("Create a new card in Backlog"));

    await waitFor(() => {
      expect(screen.getByText("Card created!")).toBeInTheDocument();
    });

    expect(onBoardUpdated).toHaveBeenCalledTimes(1);
  });

  it("shows error when suggestion fails", async () => {
    mockSendChat.mockRejectedValue(new Error("AI service returned an error (HTTP 500). Please try again."));

    render(<ChatSidebar username="user" boardId={1} onBoardUpdated={onBoardUpdated} />);

    await userEvent.click(screen.getByText("Summarize the board status"));

    await waitFor(() => {
      expect(screen.getByText(/AI service returned an error/i)).toBeInTheDocument();
    });
  });

  it("shows clear button after messages and resets to suggestions", async () => {
    mockSendChat.mockResolvedValue({ reply: "Hi!", board_updated: false });
    const user = userEvent.setup();

    render(<ChatSidebar username="user" boardId={1} onBoardUpdated={onBoardUpdated} />);

    // No clear button when empty
    expect(screen.queryByTestId("chat-clear")).not.toBeInTheDocument();

    // Send a message
    await user.type(screen.getByTestId("chat-input"), "hello");
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() => {
      expect(screen.getByText("Hi!")).toBeInTheDocument();
    });

    // Clear button should be visible
    const clearBtn = screen.getByTestId("chat-clear");
    expect(clearBtn).toBeInTheDocument();

    // Click clear
    await user.click(clearBtn);

    // Messages gone, suggestions back
    expect(screen.queryByText("Hi!")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-suggestions")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-clear")).not.toBeInTheDocument();
  });

  it("does not send empty messages", async () => {
    const user = userEvent.setup();

    render(<ChatSidebar username="user" boardId={1} onBoardUpdated={onBoardUpdated} />);

    await user.type(screen.getByTestId("chat-input"), "   ");
    await user.click(screen.getByTestId("chat-send"));

    expect(mockSendChat).not.toHaveBeenCalled();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatSidebar } from "@/components/ChatSidebar";

vi.mock("@/lib/api", () => ({
  sendChat: vi.fn(),
}));

import { sendChat } from "@/lib/api";

const mockSendChat = vi.mocked(sendChat);

describe("ChatSidebar", () => {
  const onBoardUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state with placeholder text", () => {
    render(<ChatSidebar username="user" onBoardUpdated={onBoardUpdated} />);

    expect(screen.getByText(/ask the ai/i)).toBeInTheDocument();
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
    expect(screen.getByTestId("chat-send")).toBeDisabled();
  });

  it("sends a message and displays response", async () => {
    mockSendChat.mockResolvedValue({ reply: "Hello!", board_updated: false });
    const user = userEvent.setup();

    render(<ChatSidebar username="user" onBoardUpdated={onBoardUpdated} />);

    await user.type(screen.getByTestId("chat-input"), "hi there");
    await user.click(screen.getByTestId("chat-send"));

    expect(screen.getByText("hi there")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Hello!")).toBeInTheDocument();
    });

    expect(mockSendChat).toHaveBeenCalledWith("user", "hi there", []);
    expect(onBoardUpdated).not.toHaveBeenCalled();
  });

  it("calls onBoardUpdated when AI updates the board", async () => {
    mockSendChat.mockResolvedValue({ reply: "Card added.", board_updated: true });
    const user = userEvent.setup();

    render(<ChatSidebar username="user" onBoardUpdated={onBoardUpdated} />);

    await user.type(screen.getByTestId("chat-input"), "add a card");
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() => {
      expect(screen.getByText("Card added.")).toBeInTheDocument();
    });

    expect(onBoardUpdated).toHaveBeenCalledTimes(1);
  });

  it("shows error message on failure", async () => {
    mockSendChat.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();

    render(<ChatSidebar username="user" onBoardUpdated={onBoardUpdated} />);

    await user.type(screen.getByTestId("chat-input"), "hello");
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() => {
      expect(screen.getByText(/failed to get a response/i)).toBeInTheDocument();
    });
  });

  it("disables send button while sending", async () => {
    let resolveChat: (value: { reply: string; board_updated: boolean }) => void;
    mockSendChat.mockImplementation(
      () => new Promise((resolve) => { resolveChat = resolve; })
    );
    const user = userEvent.setup();

    render(<ChatSidebar username="user" onBoardUpdated={onBoardUpdated} />);

    await user.type(screen.getByTestId("chat-input"), "test");
    await user.click(screen.getByTestId("chat-send"));

    expect(screen.getByText("Thinking...")).toBeInTheDocument();
    expect(screen.getByTestId("chat-send")).toBeDisabled();

    resolveChat!({ reply: "done", board_updated: false });

    await waitFor(() => {
      expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
    });
  });

  it("does not send empty messages", async () => {
    const user = userEvent.setup();

    render(<ChatSidebar username="user" onBoardUpdated={onBoardUpdated} />);

    await user.type(screen.getByTestId("chat-input"), "   ");
    await user.click(screen.getByTestId("chat-send"));

    expect(mockSendChat).not.toHaveBeenCalled();
  });
});

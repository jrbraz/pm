# AI Improvement Suggestions

Ideas to enhance the AI assistant in the Kanban board project, from quick wins to advanced features.

---

## Current State

- **Model**: `openai/gpt-oss-120b` via OpenRouter
- **Capabilities**: Create, edit, move, delete cards and columns via chat
- **Context**: Full board JSON + up to 20 history messages
- **Response**: Single JSON round-trip (no streaming)
- **UI**: Simple chat sidebar with text input

---

## Quick Wins

### 1. Switch to Claude API
Replace OpenRouter with the Anthropic API directly. Claude models are strong at structured JSON output and instruction following.

- Use `claude-sonnet-4-5-20250514` for fast, cost-effective responses
- Use `claude-opus-4-0-20250514` for complex multi-step board modifications
- The Anthropic SDK (`anthropic` Python package) has better error handling and retry logic than raw httpx calls

### 2. Streaming Responses
Currently the user waits 10-30 seconds staring at "Thinking..." with no feedback.

- Use the Anthropic streaming API (`client.messages.stream()`)
- Stream the `reply` text token by token to the frontend via Server-Sent Events (SSE)
- Apply the `board_update` only after the full response is complete
- This makes the AI feel much more responsive

### 3. Smarter System Prompt
The current prompt is functional but can be improved:

- Add the current date so the AI can set relative due dates ("next Monday", "end of week")
- Include the username so the AI can set `created_by` on new cards
- Add the sequential card ID counter so the AI generates correct `CARD-N` IDs instead of random strings
- Include board member list so the AI can assign cards to real users

### 4. Retry with Backoff
If the AI request fails, automatically retry once or twice with exponential backoff before showing an error. Most failures are transient network issues.

### 5. Response Validation
Currently, malformed AI responses crash silently. Add validation:

- Validate the `board_update` against the `BoardData` Pydantic model before saving
- If validation fails, return the `reply` text but skip the board update
- Log the invalid response for debugging

---

## Medium Effort

### ~~6. Suggested Prompts~~ (DONE)
~~Show clickable suggestion chips when the chat is empty.~~

Implemented: 5 suggestion chips appear in the empty chat state. Clicking a chip sends the prompt directly to the AI. Chips hide once the conversation starts.

### 7. AI Card Summaries
Add a "Summarize" button on the board header that asks the AI:

- Board health overview (overdue count, bottlenecks)
- Cards stuck in a column too long
- Workload distribution per assignee
- Sprint progress summary

Display the summary in a modal or panel.

### 8. Natural Language Due Dates
Enhance the system prompt so the AI understands relative dates:

- "due next Friday" -> calculates the actual date
- "due in 3 days" -> adds to today's date
- "due end of month" -> last day of current month

Include the current date in the system prompt context.

### 9. Undo Last AI Action
Store the board state before applying an AI update. Add an "Undo" button that appears after the AI modifies the board. This gives users confidence to experiment with AI commands.

### 10. Multi-Turn Context Awareness
Improve the AI's ability to reference previous actions:

- "Move that card to Done" (referring to the card just created)
- "Change its priority to high" (referring to the last mentioned card)
- Add a `last_modified_card_id` to the conversation context

---

## Advanced Features

### 11. AI-Powered Card Creation from Text
Paste a block of text (meeting notes, email, requirements doc) and have the AI extract action items as cards:

- "Create cards from these meeting notes: ..."
- AI parses the text, creates multiple cards with titles, details, and suggested priorities
- Shows a preview of cards to be created before applying

### 12. Board Automation Rules via AI
Let users describe automation rules in natural language:

- "When a card moves to Done, remove all checklist items"
- "When a card is overdue, set priority to critical"
- "Every Monday, create a card called 'Weekly standup notes' in Backlog"

The AI translates these into stored rules that run automatically.

### 13. AI Sprint Planning
Ask the AI to help plan a sprint:

- "Plan a 2-week sprint from the Backlog"
- AI selects cards based on priority, estimates, and team capacity
- Suggests which cards to move to "In Progress"
- Balances workload across assignees

### 14. Smart Card Splitting
Ask the AI to break large cards into smaller sub-tasks:

- "Split CARD-5 into smaller tasks"
- AI analyzes the card's title and details
- Creates 3-5 sub-cards with related titles
- Places them in the same column

### 15. Board Templates from Description
Create entire board structures from a natural language description:

- "Create a board for a mobile app launch with columns for Design, Development, QA, and Release"
- AI generates columns and seed cards based on the description

### 16. AI Comment Summaries
When a card has many comments, add a "Summarize discussion" button that asks the AI to:

- Extract key decisions
- List action items
- Identify unresolved questions

### 17. Cross-Board Intelligence
Let the AI reason across multiple boards:

- "What are my most urgent tasks across all boards?"
- "Move CARD-3 from Board A to Board B"
- "Show me a unified view of all overdue cards"

### 18. Voice Input
Add speech-to-text for the chat input:

- Use the Web Speech API (browser-native, no cost)
- "Add a card called fix login bug with high priority"
- Especially useful on mobile or during standups

---

## Architecture Improvements

### 19. Separate AI Response Parsing
Currently the AI must return the entire board state for any change. This is expensive and error-prone.

Better approach:
- Define discrete operations: `create_card`, `move_card`, `update_card`, `delete_card`
- Use Claude's tool use feature to let the AI call these operations
- Each operation is validated independently
- Smaller payloads, fewer tokens, less chance of corruption

Example with Claude tool use:
```python
tools = [
    {
        "name": "create_card",
        "description": "Create a new card in a column",
        "input_schema": {
            "type": "object",
            "properties": {
                "column_id": {"type": "string"},
                "title": {"type": "string"},
                "details": {"type": "string"},
                "priority": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
            },
            "required": ["column_id", "title"]
        }
    },
    {
        "name": "move_card",
        "description": "Move a card to a different column",
        "input_schema": {
            "type": "object",
            "properties": {
                "card_id": {"type": "string"},
                "target_column_id": {"type": "string"},
            },
            "required": ["card_id", "target_column_id"]
        }
    }
]
```

This is the single biggest architectural improvement possible.

### 20. Token Optimization
Reduce token cost per request:

- Send a compressed board summary instead of the full JSON (column names + card titles only)
- Only send full card details for cards the user mentions
- Cache the system prompt across requests (Anthropic supports prompt caching)
- Use `claude-haiku-4-5-20251001` for simple queries (move, delete) and `claude-sonnet-4-5-20250514` for complex ones

### 21. Conversation Memory
Store chat history server-side per board:

- Persist messages in a `chat_history` table
- Load history when opening a board
- Allow users to clear history
- Useful for team context ("what did the AI suggest yesterday?")

---

## Priority Recommendation

If starting today, implement in this order:

1. **Switch to Claude API** (#1) -- Better model, better SDK
2. **Tool use for operations** (#19) -- Biggest quality improvement
3. **Streaming responses** (#2) -- Best UX improvement
4. **Smarter system prompt** (#3) -- Quick win, big impact
5. **Suggested prompts** (#6) -- Discoverability
6. **Undo last action** (#9) -- User confidence
7. **AI card summaries** (#7) -- High-value feature

# Codex Feature Suggestions

Reviewed on 2026-04-02.

This document suggests product features that fit the current codebase and architecture:
- Next.js frontend
- FastAPI backend
- SQLite persistence
- local Docker deployment
- AI-assisted board operations

The goal here is not to expand scope blindly. These suggestions are biased toward features that are useful, understandable, and realistically incremental from the current implementation.

## Recommended Next Features

### 1. Real read-only and shared-workspace roles

Why it is worth doing:
- The project already has board members and `viewer` / `member` roles in the backend.
- The UI does not fully express those roles yet.
- Finishing this would make shared boards feel like a real product instead of a partial backend capability.

What to add:
- Read-only board mode for viewers
- Owner/member/viewer badges in the board header
- Clear disabled states for actions viewers cannot perform
- Shared-board presence in the main sidebar, not just the dashboard

Why this is a strong next step:
- It unlocks real collaboration without needing a full auth redesign first.
- Most of the data model already exists.

### 2. Due-date workflow

Why it is worth doing:
- Cards already support `due_date`.
- Overdue counts already exist in dashboard and board stats.
- The project has the data but not the workflow around it.

What to add:
- “Due today”, “Due this week”, and “Overdue” filters
- Visual due-date chips directly on cards
- Sort by due date inside a column
- Simple overdue highlight states

Why this is a strong next step:
- It makes the board much more useful without changing the core model.
- It gives the AI better structure for planning and prioritization.

### 3. Checklist progress on cards

Why it is worth doing:
- Checklists are already part of the card schema.
- Progress is already counted in board stats.
- The main board view does not yet surface checklist progress well.

What to add:
- Checklist progress indicator on each card, for example `3/5`
- Quick “add checklist item” flow in card detail
- Filter for cards with incomplete checklist items
- Optional “show only blocked work” filter based on checklist completion

Why this is a strong next step:
- It turns checklists from hidden metadata into useful planning signals.

### 4. Better AI actions with explicit confirmation

Why it is worth doing:
- AI is already a major feature.
- Today the AI can update boards, but the UX can become safer and more understandable.

What to add:
- Preview of proposed AI changes before applying them
- Diff-style summary: created, moved, renamed, deleted
- Optional “apply” / “discard” step for destructive AI actions
- Suggested prompts for common operations

Why this is a strong next step:
- It improves trust in the AI without changing the backend architecture much.
- It reduces fear around large or ambiguous board edits.

## High-Value Product Additions

### 5. Card activity timeline

What to add:
- Show card move history, comment history, role changes, and edits in a cleaner timeline
- Add activity on card rename, priority change, due-date change, and checklist changes

Why:
- Activity logging already exists.
- This makes collaboration and AI edits easier to audit.

### 6. Board templates

What to add:
- Create a board from a template
- Starter templates such as Product Roadmap, Sprint Board, Bug Triage, Personal Tasks
- Save an existing board as a reusable template

Why:
- This fits the current board-as-JSON model very well.
- It is easy to understand and useful immediately.

### 7. Search and command palette

What to add:
- Global search for cards across boards
- Quick command palette for “create card”, “go to board”, “move card”, “ask AI”
- Keyboard shortcuts for common actions

Why:
- This would make the app feel much faster and more serious without changing core persistence.

### 8. Notifications inside the app

What to add:
- Simple in-app notifications for AI changes, member invites, and overdue work
- “Board updated by another user” notice with refresh action
- Mention-like highlighting when a user is assigned to a card

Why:
- The app is starting to support collaboration; feedback loops become important quickly.

## Good MVP-Plus Features

### 9. Card labels as a first-class workflow

What to add:
- Label picker instead of only comma-separated text
- Label color system
- Saved label list per board
- Filter by multiple labels

Why:
- Labels already exist in the schema.
- This improves board scanning and filtering a lot.

### 10. Board archive instead of hard delete

What to add:
- Archive board
- Archived boards list
- Restore archived board

Why:
- Safer than delete
- Very useful once users have multiple boards

### 11. Simple recurring cards

What to add:
- Daily, weekly, or monthly recurrence
- Auto-create next instance after completion

Why:
- This is useful for personal operations and team rituals.
- It is practical without requiring a full calendar product.

### 12. AI-generated standup / summary view

What to add:
- “Summarize this board”
- “What changed since yesterday?”
- “What is blocked?”
- “Draft sprint update”

Why:
- This plays directly to the AI feature.
- It is high-value without needing the AI to mutate board state every time.

## Bigger Features Worth Considering Later

### 13. Real authentication

What to add:
- Backend-enforced auth
- Hashed-password login as the only path
- Session expiry and logout UX cleanup

Why:
- This becomes necessary before any non-local usage.
- It is important, but not the best “feature” if the near-term goal is product momentum.

### 14. Real-time collaboration

What to add:
- Live board updates with WebSockets or SSE
- Presence indicators
- Conflict-aware updates

Why:
- This is a natural long-term direction, especially with shared boards.
- It is much more complex than the items above, so it should come after role-aware UX and clearer collaboration flows.

### 15. Attachments

What to add:
- File attachments on cards
- Image previews
- Basic link attachments

Why:
- Users expect this eventually.
- It adds storage and upload complexity, so it is probably not the next step for a local MVP.

## Suggested Prioritization

If the goal is best product value for the least architectural risk, this is the order I would recommend:

1. Real role-aware shared boards
2. Due-date workflow
3. Checklist progress on cards
4. Safer AI with preview/confirmation
5. Board templates
6. Activity timeline improvements
7. Search / command palette

## Suggested Theme for the Next Iteration

If you want one coherent direction instead of isolated features, I would frame the next version as:

**“Collaborative planning with AI assistance.”**

That means prioritizing:
- shared boards that feel complete
- visible permissions
- better activity history
- AI summaries and safe AI changes
- stronger planning signals like due dates and checklist progress

This direction fits what the project already does well and avoids turning it into a generic task app too early.

# Codex Feature Suggestions

Reviewed on 2026-04-02.

This document suggests product features that fit the current codebase and architecture:
- Next.js frontend
- FastAPI backend
- SQLite persistence
- local Docker deployment
- AI-assisted board operations

The goal here is not to expand scope blindly. These suggestions are biased toward features that are useful, understandable, and realistically incremental from the current implementation.

## Recently Completed

### Due-date workflow

Implemented:
- “Due today”, “Due this week”, and “Overdue” filters
- Visual due-date chips directly on cards
- Due-date sorting inside each column as a view mode
- Clear overdue highlight states on cards

Notes:
- This was a strong fit because the card schema already had `due_date`.
- The implementation stays inside the existing board model and improves planning without adding backend complexity.

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

### 2. Checklist progress on cards

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

### 3. Better AI actions with explicit confirmation

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

### 4. Card activity timeline

What to add:
- Show card move history, comment history, role changes, and edits in a cleaner timeline
- Add activity on card rename, priority change, due-date change, and checklist changes

Why:
- Activity logging already exists.
- This makes collaboration and AI edits easier to audit.

### 5. Board templates

What to add:
- Create a board from a template
- Starter templates such as Product Roadmap, Sprint Board, Bug Triage, Personal Tasks
- Save an existing board as a reusable template

Why:
- This fits the current board-as-JSON model very well.
- It is easy to understand and useful immediately.

### 6. Search and command palette

What to add:
- Global search for cards across boards
- Quick command palette for “create card”, “go to board”, “move card”, “ask AI”
- Keyboard shortcuts for common actions

Why:
- This would make the app feel much faster and more serious without changing core persistence.

### 7. Notifications inside the app

What to add:
- Simple in-app notifications for AI changes, member invites, and overdue work
- “Board updated by another user” notice with refresh action
- Mention-like highlighting when a user is assigned to a card

Why:
- The app is starting to support collaboration; feedback loops become important quickly.

## Good MVP-Plus Features

### 8. Card labels as a first-class workflow

What to add:
- Label picker instead of only comma-separated text
- Label color system
- Saved label list per board
- Filter by multiple labels

Why:
- Labels already exist in the schema.
- This improves board scanning and filtering a lot.

### 9. Board archive instead of hard delete

What to add:
- Archive board
- Archived boards list
- Restore archived board

Why:
- Safer than delete
- Very useful once users have multiple boards

### 10. Simple recurring cards

What to add:
- Daily, weekly, or monthly recurrence
- Auto-create next instance after completion

Why:
- This is useful for personal operations and team rituals.
- It is practical without requiring a full calendar product.

### 11. AI-generated standup / summary view

What to add:
- “Summarize this board”
- “What changed since yesterday?”
- “What is blocked?”
- “Draft sprint update”

Why:
- This plays directly to the AI feature.
- It is high-value without needing the AI to mutate board state every time.

## Bigger Features Worth Considering Later

### 12. Real authentication

What to add:
- Backend-enforced auth
- Hashed-password login as the only path
- Session expiry and logout UX cleanup

Why:
- This becomes necessary before any non-local usage.
- It is important, but not the best “feature” if the near-term goal is product momentum.

### 13. Real-time collaboration

What to add:
- Live board updates with WebSockets or SSE
- Presence indicators
- Conflict-aware updates

Why:
- This is a natural long-term direction, especially with shared boards.
- It is much more complex than the items above, so it should come after role-aware UX and clearer collaboration flows.

### 14. Attachments

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
2. Checklist progress on cards
3. Safer AI with preview/confirmation
4. Board templates
5. Activity timeline improvements
6. Search / command palette
7. Notifications inside the app

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

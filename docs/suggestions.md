# Feature Suggestions

Ideas for future development, organized by priority and complexity.

---

## High Priority -- Quick Wins

### 1. Card Archiving
Instead of permanently deleting cards, move them to an archive. Archived cards can be restored or permanently deleted later. This prevents accidental data loss.

- Add `archived: boolean` field to Card model
- Add "Archive" action on card (move to hidden state)
- Add "Archived Cards" section at the bottom of each column or as a board-level view

### ~~2. Card Duplication~~ (DONE)
~~Allow users to duplicate an existing card within the same column. Copies all fields except assigns a new sequential ID and sets `created_by` to the current user.~~

Implemented: Duplicate button (copy icon) appears on hover next to the delete button on each card. Creates a copy in the same column with a new sequential CARD-N ID and the current user as `created_by`.

### 3. Column WIP Limits
Set a maximum number of cards per column (e.g., "In Progress" max 3). Show a visual warning when the limit is reached. Helps enforce workflow discipline.

### 4. Saved Filter Views
Let users save filter combinations (e.g., "My High Priority" = priority:high + assignee:me) and switch between them quickly from the filter bar.

### 5. Card Attachments
Allow file uploads on cards (images, documents). Store files in a `uploads/` directory with references in the card JSON. Show thumbnails on cards.

---

## High Priority -- Medium Effort

### 6. Notifications
Notify users when:
- They are assigned to a card
- Someone comments on their card
- A board they belong to is updated
- They are invited to a board

Start with in-app notifications (bell icon with unread count), then optionally add email.

### 7. @Mentions in Comments
Allow `@username` mentions in comments. Mentioned users receive a notification. Render mentions as highlighted links in the comment body.

### 8. Card Dependencies
Add "blocks" and "blocked by" relationships between cards. Show dependency indicators on cards. Prevent moving a blocked card to "Done" until its blockers are resolved.

### 9. Board Templates
Offer pre-built board templates when creating a new board:
- **Kanban** (Backlog, In Progress, Done)
- **Scrum Sprint** (To Do, In Progress, Review, Done)
- **Bug Tracking** (Reported, Triaging, Fixing, Testing, Resolved)
- **Custom** (empty board)

### 10. Calendar View
Show cards with due dates on a calendar. Allow drag-and-drop to change due dates. Provides a time-based perspective alongside the Kanban column view.

---

## Medium Priority -- Enhancements

### 11. Board Analytics & Reports
Add a stats page per board with:
- Burndown chart (cards remaining over time)
- Cards completed per week
- Average time cards spend in each column (cycle time)
- Workload distribution per assignee
- Overdue trend line

### 12. Bulk Card Actions
Select multiple cards (checkbox mode) and perform actions:
- Move to column
- Change priority
- Assign to member
- Delete / Archive
- Add label

### 13. Real-Time Collaboration
Use WebSockets (or Server-Sent Events) to push board changes to all connected clients. Show live cursors or "user X is editing" indicators. Eliminates the need for the "Reload" banner.

### 14. Dark Mode
Add a dark theme toggle. Use CSS variables to swap the color scheme. Persist preference in localStorage.

### 15. Card Time Tracking
Add optional time tracking to cards:
- Estimated hours
- Logged hours (manual entry or start/stop timer)
- Show progress bar (logged vs. estimated)
- Aggregate time per column in board stats

### 16. Swimlanes
Group cards horizontally by assignee, label, or priority. Useful for seeing workload distribution at a glance.

### 17. Board Export
Export board data as:
- **CSV** (flat table of all cards)
- **JSON** (full board state for backup)
- **PDF** (printable board snapshot)

---

## Lower Priority -- Advanced

### 18. Board Automation Rules
Simple "when X then Y" rules:
- When a card moves to "Done", uncheck all checklist items
- When a card is assigned, move it to "In Progress"
- When due date passes, set priority to "high"
- When all checklist items are done, move card to "Review"

### 19. Recurring Cards
Create cards that auto-regenerate on a schedule (daily, weekly, monthly). Useful for recurring tasks like "Weekly standup notes" or "Monthly report".

### 20. Public Board Links
Generate a read-only shareable link for a board. Anyone with the link can view the board without logging in. Useful for stakeholder visibility.

### 21. Webhook Integrations
Fire HTTP webhooks on board events:
- Card created/moved/completed
- Comment added
- Member invited

Enables integration with Slack, Discord, email services, and custom workflows.

### 22. Card Linking
Link related cards across boards. Show linked cards in the detail panel. Useful for cross-project dependencies.

### 23. Advanced Search
Full-text search across all boards:
- Search by card title, details, comments
- Filter by date range, assignee, board
- Show results with board context

### 24. Mobile-Responsive Layout
Optimize the board view for mobile screens:
- Stack columns vertically
- Swipe between columns
- Touch-friendly card actions

### 25. AI Improvements
- Let AI suggest priorities based on card content and deadlines
- Auto-categorize cards with labels based on title/description
- Weekly summary: AI generates a digest of board activity
- Smart card suggestions: "You might want to break this card into smaller tasks"

---

## Technical Improvements

### 26. Rate Limiting
Add API rate limiting to prevent abuse. Suggested limits:
- 100 requests/minute per user for read endpoints
- 30 requests/minute per user for write endpoints
- 5 requests/minute for AI chat

### 27. Soft Deletes
Instead of permanently deleting boards, members, and comments, add a `deleted_at` timestamp. Show a "Trash" section where items can be restored within 30 days.

### 28. Database Optimization
- Add indexes for common query patterns
- Consider migrating from SQLite to PostgreSQL for production multi-user scenarios
- Add connection pooling

### 29. Offline Support
Queue changes locally when offline using IndexedDB or localStorage. Sync when the connection is restored. Show an "offline" indicator in the UI.

### 30. Audit Log Expansion
Track all card-level mutations in the activity log:
- Card created, edited, moved, archived, deleted
- Priority changed, assignee changed, due date changed
- Checklist item added/completed

# Plan: Card Types & Hierarchy

Implementation plan for introducing card types with a 3-level hierarchy and sub-tasks.

---

## Card Type Hierarchy

```
Level 1: Initiative          (top-level, no parent)
  Level 2: Epic              (parent: Initiative)
    Level 3: Task            (parent: Epic)
    Level 3: Story           (parent: Epic)
    Level 3: Change Scope    (parent: Epic)
      Sub-task               (parent: Task, Story, or Change Scope)
```

### Type Definitions

| Type         | Level | Color   | ID Prefix | Description                                      |
|--------------|-------|---------|-----------|--------------------------------------------------|
| Initiative   | 1     | #753991 | INIT-     | High-level strategic goal spanning multiple epics |
| Epic         | 2     | #209dd7 | EPIC-     | Large body of work broken into level-3 items      |
| Task         | 3     | #38a169 | TASK-     | A concrete unit of work                           |
| Story        | 3     | #ecad0a | STORY-    | A user-facing feature or behavior                 |
| Change Scope | 3     | #e53e3e | CS-       | A scope change or deviation from the plan         |
| Sub-task     | 3.1   | #888888 | ST-       | A child item of any level-3 card                  |

### Icons (SVG)

Each type has a dedicated icon to make them instantly recognizable:

```
Initiative   -- Flag icon (strategic direction)
Epic         -- Lightning bolt icon (large effort)
Task         -- Checkmark circle icon (actionable work)
Story        -- Book/document icon (user narrative)
Change Scope -- Warning triangle icon (scope deviation)
Sub-task     -- Nested dot icon (child item)
```

Icons should be implemented as a `CardTypeIcon` component in `Icons.tsx` that accepts a `cardType` prop and renders the appropriate SVG at a given size and color.

---

## Data Model Changes

### Backend: Card model (`board_models.py`)

Add two new fields to the `Card` model:

```python
class Card(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    details: str
    card_type: Literal["initiative", "epic", "task", "story", "change_scope", "sub_task"] = "initiative"
    parent_id: str | None = None  # ID of the parent card (for hierarchy)
    priority: ...
    # ... existing fields
```

**Validation rules (strict hierarchy):**
- `initiative` cards: `parent_id` must be `None` (top-level only, no parent)
- `epic` cards: `parent_id` is required and must reference an `initiative` card
- `task` / `story` / `change_scope` cards: `parent_id` is required and must reference an `epic` card
- `sub_task` cards: `parent_id` is required and must reference a `task`, `story`, or `change_scope` card

### Frontend: Card type (`kanban.ts`)

```typescript
export type CardType = "initiative" | "epic" | "task" | "story" | "change_scope" | "sub_task";

export type Card = {
  id: string;
  title: string;
  details: string;
  card_type?: CardType;
  parent_id?: string | null;
  // ... existing fields
};
```

### Type-prefixed card IDs

Each card type uses a unique ID prefix instead of the generic `CARD-N`:

| Type         | Prefix  | Example  |
|--------------|---------|----------|
| Initiative   | INIT-   | INIT-1   |
| Epic         | EPIC-   | EPIC-2   |
| Task         | TASK-   | TASK-3   |
| Story        | STORY-  | STORY-4  |
| Change Scope | CS-     | CS-5     |
| Sub-task     | ST-     | ST-6     |

The user-level `card_seq` counter remains global across all types to guarantee uniqueness.
The `POST /api/users/{username}/next-card-id` endpoint should accept a `card_type` parameter and return the prefixed ID (e.g., `{"card_id": "EPIC-9"}`).

### Default values
- New cards default to `card_type: "initiative"`
- Existing cards without `card_type` are treated as `"initiative"`
- `parent_id` defaults to `null` (no parent)

---

## Phase 1: Core Data & Backend

### 1.1 Update Card model
- Add `card_type` field with default `"initiative"`
- Add `parent_id` field with default `None`
- Existing boards with old cards will work (defaults apply)

### 1.2 Add hierarchy validation
- Add a `validate_card_hierarchy` model validator to `BoardData`
- Validate `parent_id` references exist in the `cards` dict
- Enforce strict parent rules: only `initiative` can have `parent_id: None`; all other types require a valid parent of the correct type
- Reject saves that violate the hierarchy

### 1.3 Update card ID generation
- Update `reserve_next_card_id` to accept a `card_type` parameter
- Return prefixed IDs: `INIT-1`, `EPIC-2`, `TASK-3`, etc.
- Frontend sends the selected type when requesting a new ID

### 1.4 Update AI system prompt
- Teach the AI about card types and the hierarchy rules
- When creating cards, AI should set `card_type` based on context
- AI should be able to create parent-child relationships
- AI must use the correct ID prefix for each type
- Example: "Break this initiative into epics" creates epic cards with `parent_id` pointing to the initiative

### 1.5 Update DEFAULT_BOARD sample cards
Assign proper types to the 8 sample cards to showcase the hierarchy on first login:

```
INIT-1  "Align roadmap themes"         initiative  parent: None
INIT-2  "Gather customer signals"       initiative  parent: None
EPIC-3  "Prototype analytics view"      epic        parent: INIT-1
EPIC-4  "Refine status language"        epic        parent: INIT-1
EPIC-5  "Design card layout"            epic        parent: INIT-2
TASK-6  "QA micro-interactions"         task        parent: EPIC-3
TASK-7  "Ship marketing page"           task        parent: EPIC-4
TASK-8  "Close onboarding sprint"       task        parent: EPIC-5
```

Set the initial `card_seq` to 8.

### 1.6 Write tests
- Test card creation with each type and correct ID prefix
- Test hierarchy validation (valid and invalid parent-child relationships)
- Test that non-initiative cards without a parent are rejected
- Test backward compatibility (cards without `card_type` default to "initiative")
- Test AI prompt includes card type instructions

---

## Phase 2: Card Display & Visual Hierarchy

### 2.1 Type badge on cards
Show a colored type badge with icon on each card in the Kanban column view:

```
[flag] INIT-1  Align roadmap themes
[bolt] EPIC-3  Prototype analytics view
[check] TASK-6  QA micro-interactions
```

- Badge uses the type icon + color from the definitions table
- Badge is shown next to the card ID
- Sub-tasks show a smaller, indented style

### 2.2 Sub-task display mode
Sub-tasks do NOT appear as standalone cards in columns. Instead they render nested inside their parent card:

```
[check] TASK-6  QA micro-interactions
  [dot] ST-9   Check hover states
  [dot] ST-10  Check focus states
  [dot] ST-11  Check loading states
```

- Sub-tasks show as a compact list inside the parent card (similar to checklist but with richer data)
- Clicking a sub-task opens its detail panel
- Parent card shows a progress indicator: "2/3 sub-tasks done"

### 2.3 Type icon in card detail panel
- Show the type icon and label in the card detail panel header
- Add a type selector dropdown to change the card type
- Show parent card link (clickable, opens the parent card)
- Show child cards list below the card details

### 2.4 Type filter in BoardFilterBar
- Add a "Type" filter group to the filter bar (same pattern as Priority and Due Date)
- Buttons: Initiative, Epic, Task, Story, Change Scope
- Clicking filters the board to show only cards of that type (and their visible sub-tasks)

### 2.5 Visual nesting indicator
- Cards that have children show a count badge: "3 epics" or "2 tasks, 1 story"
- Cards that have a parent show a breadcrumb: "INIT-1: Align roadmap themes"
- Use a subtle left border in the parent's type color to indicate hierarchy

### 2.6 Card count per type in column header
- Update column headers to show counts per type instead of just total
- Example: `3 tasks, 1 story` instead of `4 cards`
- Falls back to `4 cards` if all cards are the same type

---

## Phase 3: Card Creation & Relationships

### 3.1 Type selector in NewCardForm
- Add a type dropdown to the card creation form
- Smart default type based on context:
  - Creating in a column with mostly epics -> suggest epic
  - Creating from "Add child" on initiative -> default to epic
  - Creating from "Add child" on epic -> default to task
  - Creating from "Add child" on task/story/change_scope -> default to sub_task
  - Otherwise -> default to initiative
- Show the type icon next to the dropdown

### 3.2 "Add child" action on cards
- Add a "+" button on cards that can have children (initiative, epic, task, story, change_scope)
- Clicking opens the new card form pre-filled with:
  - `parent_id` set to the current card
  - `card_type` set to the appropriate child type:
    - Initiative -> Epic
    - Epic -> user chooses Task, Story, or Change Scope (dropdown)
    - Task / Story / Change Scope -> Sub-task

### 3.3 "Convert type" action
- Allow changing a card's type via a dropdown in the detail panel
- Validate that the conversion respects hierarchy:
  - Can't convert a card that has children to a type that doesn't support those children
  - Can't convert a task with sub-tasks into a sub-task itself
- Warn if the conversion would break parent-child relationships
- Auto-update the card's ID prefix on conversion (TASK-6 becomes STORY-6)

### 3.4 Drag sub-tasks between parents
- Allow dragging a sub-task from one parent to another
- Update `parent_id` on drop
- Only allow valid parent types (task, story, change_scope)

---

## Phase 4: Hierarchy Views

### 4.1 Tree view
- Add a "Tree" view toggle on the board header (next to the sort dropdown)
- Tree view shows cards in a hierarchical tree instead of columns:
  ```
  [flag] INIT-1: Align roadmap themes
    [bolt] EPIC-3: Prototype analytics view
      [check] TASK-6: QA micro-interactions
        [dot] ST-9: Check hover states
        [dot] ST-10: Check focus states
      [check] TASK-7: Ship marketing page
    [bolt] EPIC-4: Refine status language
  [flag] INIT-2: Gather customer signals
    [bolt] EPIC-5: Design card layout
      [check] TASK-8: Close onboarding sprint
  ```
- Collapsible nodes for initiative and epic levels
- Click to open card detail panel
- Show column name as a status badge on each card

### 4.2 Board stats by type
- Update the BoardStatsBar to show counts per type
- Example: "2 initiatives, 3 epics, 3 tasks"
- Each count uses the type color

### 4.3 Dashboard breakdown
- Update the dashboard to show cards grouped by type
- Show completion progress per initiative (% of descendant cards in "Done" column)
- Show epic progress bars

---

## Phase 5: Advanced Features

### 5.1 Progress roll-up
- An epic's progress = percentage of its child cards (task/story/change_scope) in the "Done" column
- An initiative's progress = percentage of its child epics where all children are done
- Show progress bars on initiative and epic cards
- Progress is computed client-side from column membership

### 5.2 Scope tracking
- "Change Scope" cards are visually distinct (red accent border, warning icon)
- Track scope changes over time per initiative/epic
- Show a scope change count on parent cards: "2 scope changes"
- Log scope changes in the activity feed

### 5.3 AI-powered breakdown
- "Break down this initiative into epics" -- AI creates child epic cards with correct `parent_id` and `EPIC-` prefixed IDs
- "Split this epic into tasks and stories" -- AI creates child cards with appropriate types
- "Add sub-tasks to this task" -- AI creates sub-task cards nested under the task
- AI respects the hierarchy validation rules

### 5.4 Bulk type assignment
- Select multiple cards and assign a type
- Select multiple cards and set a parent
- Validate hierarchy rules on bulk operations

---

## Delete Cascade Strategy

When deleting a card that has children, the user is prompted with two options:

### Option A: "Delete all children"
- Recursively delete the card and all its descendants
- Example: deleting an initiative also deletes its epics, their tasks, and their sub-tasks
- Activity log records each deletion

### Option B: "Promote children"
- Delete the card but move its children up one level to the card's parent
- Example: deleting an epic promotes its tasks/stories to the epic's parent initiative
- Sub-tasks of promoted tasks remain attached to their task
- If the deleted card is an initiative (no parent), its epics become orphaned -- this is NOT allowed; initiative deletion always cascades

### Rules
| Deleted Type | Promote target        | Cascade allowed |
|--------------|-----------------------|-----------------|
| Initiative   | N/A (no parent)       | Yes (required)  |
| Epic         | Parent initiative     | Yes             |
| Task/Story/CS| Parent epic           | Yes             |
| Sub-task     | N/A (leaf node)       | N/A             |

---

## Migration Strategy

### Backward compatibility
- `card_type` defaults to `"initiative"` -- existing cards are treated as initiatives
- `parent_id` defaults to `null` -- existing cards remain top-level (valid for initiatives)
- No database migration needed (card data is in JSON blob)
- No schema version bump required
- Existing card IDs (e.g., `CARD-5`) remain valid; new cards get type-prefixed IDs

### Gradual rollout
1. Phase 1 can ship without any UI changes (data layer only)
2. Phase 2 adds visual indicators (read-only display)
3. Phase 3 enables creation and editing of types
4. Phase 4 adds new views
5. Phase 5 adds intelligence

Each phase is independently shippable and valuable.

---

## Implementation Order

| Step | Phase | Effort   | Description                                       |
|------|-------|----------|---------------------------------------------------|
| 1    | 1.1   | Small    | Add `card_type` and `parent_id` to model          |
| 2    | 1.3   | Small    | Update card ID generation with type prefixes       |
| 3    | 1.5   | Small    | Update DEFAULT_BOARD with typed sample cards       |
| 4    | 1.6   | Small    | Write backend tests                               |
| 5    | 2.1   | Small    | Type badge with icon on cards                      |
| 6    | 2.4   | Small    | Type filter in filter bar                          |
| 7    | 3.1   | Small    | Type selector in new card form                     |
| 8    | 1.2   | Medium   | Strict hierarchy validation                        |
| 9    | 2.2   | Medium   | Sub-task nested display inside parent cards        |
| 10   | 2.3   | Medium   | Type editing in card detail panel                  |
| 11   | 2.5   | Medium   | Visual nesting indicators and breadcrumbs          |
| 12   | 2.6   | Small    | Card count per type in column header               |
| 13   | 3.2   | Medium   | "Add child" action with smart defaults             |
| 14   | 1.4   | Medium   | Update AI system prompt for types and hierarchy    |
| 15   | 4.1   | Large    | Tree view                                          |
| 16   | 5.1   | Medium   | Progress roll-up on initiatives and epics          |
| 17   | 5.3   | Medium   | AI-powered breakdown                               |
| 18   | 4.2   | Small    | Stats by type in BoardStatsBar                     |
| 19   | 4.3   | Medium   | Dashboard breakdown by type                        |
| 20   | 5.2   | Medium   | Scope tracking with change_scope indicators        |
| 21   | 3.3   | Medium   | Convert type action with validation                |
| 22   | 3.4   | Medium   | Drag sub-tasks between parents                     |
| 23   | 5.4   | Small    | Bulk type assignment                               |

---

## Color & Icon Reference

| Type         | Color   | Icon             | ID Prefix | Visual Meaning                |
|--------------|---------|------------------|-----------|-------------------------------|
| Initiative   | #753991 | Flag             | INIT-     | Strategic direction / goal    |
| Epic         | #209dd7 | Lightning bolt   | EPIC-     | Large effort / momentum       |
| Task         | #38a169 | Checkmark circle | TASK-     | Concrete actionable work      |
| Story        | #ecad0a | Book / document  | STORY-    | User narrative / feature      |
| Change Scope | #e53e3e | Warning triangle | CS-       | Scope deviation / attention   |
| Sub-task     | #888888 | Nested dot       | ST-       | Child item, indented display  |

Colors align with the existing project color scheme defined in CLAUDE.md.

### CardTypeIcon component (`Icons.tsx`)

```tsx
export const CARD_TYPE_COLORS: Record<CardType, string> = {
  initiative: "#753991",
  epic: "#209dd7",
  task: "#38a169",
  story: "#ecad0a",
  change_scope: "#e53e3e",
  sub_task: "#888888",
};

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  initiative: "Initiative",
  epic: "Epic",
  task: "Task",
  story: "Story",
  change_scope: "Change Scope",
  sub_task: "Sub-task",
};

export const CARD_TYPE_PREFIXES: Record<CardType, string> = {
  initiative: "INIT",
  epic: "EPIC",
  task: "TASK",
  story: "STORY",
  change_scope: "CS",
  sub_task: "ST",
};

// CardTypeIcon renders the appropriate SVG based on card type.
// Usage: <CardTypeIcon type="epic" size={14} />
// The color is derived from CARD_TYPE_COLORS automatically.
```

Each icon is a distinct shape so types are recognizable even without color (accessibility):
- **Flag**: triangular pennant shape (initiative)
- **Lightning bolt**: zigzag vertical shape (epic)
- **Checkmark circle**: circle with checkmark (task)
- **Book**: open book / page shape (story)
- **Warning triangle**: triangle with exclamation (change scope)
- **Nested dot**: small filled circle with indent line (sub-task)

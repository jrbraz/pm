# Frontend Agent Guide

## Purpose

This directory contains the current Next.js frontend MVP demo for a single-board Kanban UI. It is currently frontend-only (no backend persistence yet).

## Stack

- Next.js App Router (`src/app`)
- React 19 + TypeScript
- Tailwind CSS v4 for styling
- `@dnd-kit` for drag-and-drop
- Vitest + Testing Library for unit/component tests
- Playwright for end-to-end tests

## Current App Structure

- `src/app/page.tsx`: renders `KanbanBoard` as the home page.
- `src/components/KanbanBoard.tsx`: top-level board state and DnD context.
- `src/components/KanbanColumn.tsx`: per-column UI, title rename input, add-card form, sortable list.
- `src/components/KanbanCard.tsx`: draggable card with delete action.
- `src/components/NewCardForm.tsx`: inline add-card form.
- `src/components/KanbanCardPreview.tsx`: drag overlay card preview.
- `src/lib/kanban.ts`: board/card types, seed data, card move logic, ID generation.
- `src/app/globals.css`: theme variables and global styles.

## Behavior Today

- Login gate at `/` requires MVP credentials: `user` / `password`.
- Logged-in users can view the Kanban board and log out.
- Board state is loaded from backend API (`GET /api/users/{username}/board`).
- Board mutations are persisted via backend API (`PUT /api/users/{username}/board`).
- Columns can be renamed inline.
- Cards can be created and deleted.
- Cards can be dragged within or across columns.
- Board changes persist across logout/login and page refresh.

## Testing

- Unit/component tests:
  - `src/components/AuthGate.test.tsx`
  - `src/components/KanbanBoard.test.tsx`
  - `src/app/page.test.tsx`
  - `src/app/layout.test.tsx`
  - `src/lib/api.test.ts`
  - `src/lib/kanban.test.ts`
- E2E tests:
  - `tests/kanban.spec.ts`
- Config:
  - `vitest.config.ts`
  - `playwright.config.ts`

## Commands

- `npm run dev`: start local frontend dev server.
- `npm run build`: create production build.
- `npm run lint`: run ESLint.
- `npm run test:unit`: run Vitest tests.
- `npm run test:e2e`: run Playwright against Dockerized app (auto `compose up/down`).
- `npm run test:all`: run all tests.

## Implementation Notes

- Preserve the established color variables in `globals.css` unless explicitly changing design direction.
- Keep component logic simple and colocated with current structure.
- Prefer extending `src/lib/kanban.ts` types/utilities before adding new state models.
- Keep UI behavior consistent while persisting data via backend API.

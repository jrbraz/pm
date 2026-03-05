# Backend Agent Guide

## Purpose

This directory contains the FastAPI backend for the Project Management MVP.

## Current Scope (Part 6)

- Serve statically built Next.js frontend assets at `/`.
- Expose simple API endpoints:
  - `GET /api/health`
  - `GET /api/hello`
- Expose board API endpoints by username:
  - `GET /api/users/{username}/board`
  - `PUT /api/users/{username}/board`
- Bootstrap SQLite database schema automatically on app startup.
- Provide DB-layer helpers for user and board JSON persistence.
- Provide automated backend tests for these routes.

## Structure

- `app/main.py`: FastAPI app, API routes, and static frontend mounting.
- `app/board_models.py`: Pydantic models and board validation.
- `app/board_service.py`: board read/write service logic.
- `app/db.py`: SQLite schema and persistence helpers.
- `tests/test_main.py`: backend route tests.
- `tests/test_db.py`: DB bootstrap and persistence tests.
- `tests/test_board_service.py`: service-level board tests.
- `tests/test_board_api.py`: board API tests.
- `pyproject.toml`: Python project metadata and dependencies managed with `uv`.

## Notes

- Keep backend logic simple and minimal until later phases add persistence and AI integration.
- Route namespace should remain clean (`/api/*` for API endpoints).

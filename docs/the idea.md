# Jason's Desk — Product & Technical Specification

## Overview

**Jason's Desk** is a fast-loading, self-hosted web app for organizing thoughts, planning projects, and managing daily/weekly workflows. It integrates with external tools (Todoist, Jira, Google Calendar), supports habit tracking and reflection, and is optimized for both desktop and mobile (with basic PWA features).

---

## Features

### Core Views

#### 1. Weekly View (Grid)
- **Weekly Goals:** Editable list of goals for the week.
- **Habits:** Persistent habits with streaks and "Done!" buttons. Supports daily or X-times-per-week habits.
- **Tasks:**
  - Displayed in configurable category boxes (e.g., "work," "family," "kingdom," etc., editable via server config file).
  - Tasks can be local or imported from Todoist/Jira.
- **Upcoming Meetings:** Stacked card/agenda view (Google Calendar integration, with future support for other providers via CalDAV).
- **Reflections:** Daily reflections from the week are visible here.

#### 2. Daily View (Stacked List)
- **Today's Tasks & Calendar:**
  - Combined vertical list of tasks and events.
  - "Big rocks" tasks are visually prominent.
  - Drag-and-drop to reorder tasks.
  - Inline editing for task names and notes.
  - "Triage later" section for dumping tasks to process later.
- **Weekly Goals & Habits:** Always visible.
- **Reflection Box:** Freeform notes for daily reflection, saved and shown in weekly view.

#### Planning Mode (Both Views)
- Left pane shows backlog (local, Todoist, Jira tasks).
- Drag and drop tasks into the current day or week.

---

### Task Management

- **Drag-and-drop ordering** for prioritization.
- **Mark as "big rock"** for visual emphasis.
- **Inline editing** for task names and notes.
- **Imported tasks** retain a link to the original Todoist/Jira card (editing name keeps the link).
- **No two-way sync:** Marking tasks complete in Jason's Desk does not update Todoist/Jira.
- **No attachments/metadata:** Use source tools for advanced features.

---

### Habits

- Persistent, week-to-week.
- Visible at all times with current streak.
- "Done!" button for daily completion.
- Support for daily and X-times-per-week habits.

---

### Reflection & Growth

- **Daily Reflection Box:** Freeform notes, visible in weekly view.
- No prompts/templates for now.

---

### Dopamine/Reward

- Satisfying "ticked off" state for completed items (stay visible for progress).
- Placeholder for future completion animation.

---

### Integrations

- **Google Calendar:** Periodic, one-way (read-only) sync. Flexible architecture for future CalDAV/Fastmail support.
- **Todoist:** Pull all tasks for your account.
- **Jira:** Pull tasks assigned to your username in a specified project (configurable via env file).
- **No reminders/notifications** within the app.

---

### Authentication & Data

- **Single-user** with basic username/password authentication.
- **Data stored in SQLite** (backups via file copy).
- **Syncs across devices** (server-based, with optional local caching).
- **No export/import UI** (back up SQLite file directly).

---

### Customization

- **Categories and similar settings** editable via server config file (JSON/YAML).
- **Styling:** Clean, slightly playful; CSS structured for easy tweaking.

---

### Accessibility & Keyboard

- **Keyboard navigation and shortcuts** prioritized for all major features.
- Basic accessibility (labels, tab navigation) as a minimum.

---

### Mobile & PWA

- **Responsive web design** for desktop and mobile.
- **Basic PWA features:** Home screen icon, splash screen (where supported on iPhone).
- No push notifications or advanced PWA features.

---

### Technical Stack

- **Frontend/Backend:** React Router Framework (Remix), using API routes.
- **Database:** SQLite.
- **Self-hosted** (no managed/cloud hosting).
- **Devbox** for reproducible environments (local and server).
- **Deployment:** `git pull; next build; next serve` (compatible with Devbox).
- **No Docker or special monitoring/logging** out of the box.

---

## Out of Scope (for now)

- Multi-user support
- Advanced notifications/reminders
- Attachments/metadata for tasks
- In-app backup/export/import UI
- Native mobile app
- UI for editing categories/config (config file only)

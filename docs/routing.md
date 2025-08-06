# Routing Scheme - Jason's Desk

## Overview

Jason's Desk uses React Router v7 with file-based routing. This document outlines the complete routing structure for the application's page routes.

## Core Navigation Routes

### Main Application Routes

| Route           | Description                                       | Component            |
|-----------------|---------------------------------------------------|----------------------|
| `/`             | Weekly view (current week) - default landing page | `routes/home.tsx`    |
| `/weekly`       | Weekly view (current week)                        | `routes/weekly.tsx`  |
| `/weekly/:week` | Specific week view                                | `routes/weekly.tsx`  |
| `/daily`        | Daily view (today)                                | `routes/daily.tsx`   |
| `/daily/:date`  | Specific date view                                | `routes/daily.tsx`   |

### Planning Mode Routes

Planning mode is activated via query parameters to maintain clean URLs and allow easy toggling.

| Route | Description |
|-------|-------------|
| `/weekly?mode=planning`       | Weekly planning mode with backlog sidebar |
| `/daily?mode=planning`        | Daily planning mode with backlog sidebar |
| `/weekly/:week?mode=planning` | Specific week planning mode |
| `/daily/:date?mode=planning`  | Specific date planning mode |

### Authentication Routes

| Route | Description | Component |
|-------|-------------|-----------|
| `/login` | Login page | `routes/auth/login.tsx` |
| `/logout` | Logout action (redirects to login) | `routes/auth/logout.tsx` |

### Settings Routes

| Route | Description | Component |
|-------|-------------|-----------|
| `/settings` | Basic app settings | `routes/settings.tsx` |

## URL Format Specifications

### Date Formats

- **Daily dates**: ISO format `YYYY-MM-DD`
  - Example: `/daily/2024-01-15`
- **Weekly dates**: ISO week format `YYYY-WWW`
  - Example: `/weekly/2024-W03` (3rd week of 2024)

### Query Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `mode` | `planning` | Activates planning mode with backlog sidebar |

Future query parameters may include:
- `category` - Filter tasks by category
- `view` - Alternative view modes

## Navigation Examples

| URL | Description |
|-----|-------------|
| `/` | Current week overview (default landing) |
| `/daily` | Today's tasks and schedule |
| `/daily/2024-01-15` | Tasks and schedule for January 15, 2024 |
| `/weekly/2024-W03` | Overview for the 3rd week of 2024 |
| `/daily?mode=planning` | Today's view with planning sidebar |
| `/weekly?mode=planning` | Current week with planning sidebar |
| `/weekly/2024-W03?mode=planning` | Specific week with planning sidebar |

## Route Behavior

### Default Behavior

1. **Root Route (`/`)**: Redirects to `/weekly` as the primary landing page
2. **Current Dates**: `/weekly` and `/daily` without date parameters show current week/day
3. **Authentication**: All routes except `/login` require authentication
4. **Invalid Dates**: Invalid date formats redirect to current date with error message

### Planning Mode

- Activated via `mode=planning` query parameter
- Shows backlog sidebar for drag-and-drop task planning
- Maintains current date/week context
- Can be toggled on/off without losing current view state

### Navigation Patterns

- **Date Navigation**: Previous/Next buttons maintain current view mode (daily/weekly)
- **Mode Switching**: Daily ↔ Weekly buttons maintain current date and planning mode
- **Planning Toggle**: Can be activated/deactivated without changing current date
- **Breadcrumbs**: Show current date/week and mode for context

## Implementation Notes

### Route Configuration

```typescript
// app/routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/weekly", "routes/weekly.tsx"),
  route("/weekly/:week", "routes/weekly.tsx"),
  route("/daily", "routes/daily.tsx"),
  route("/daily/:date", "routes/daily.tsx"),
  route("/login", "routes/auth/login.tsx"),
  route("/logout", "routes/auth/logout.tsx"),
  route("/settings", "routes/settings.tsx"),
] satisfies RouteConfig;
```

### Parameter Handling

- **Week Parameter**: Validated against ISO week format (`YYYY-WWW`)
- **Date Parameter**: Validated against ISO date format (`YYYY-MM-DD`)
- **Invalid Parameters**: Gracefully handled with redirects to current date
- **Query Parameters**: Parsed and maintained across navigation

### URL Generation Helpers

Routes should use helper functions for consistent URL generation:

```typescript
// utils/routing.ts
export const getWeeklyUrl = (week?: string, planning?: boolean) => {
  const base = week ? `/weekly/${week}` : '/weekly';
  return planning ? `${base}?mode=planning` : base;
};

export const getDailyUrl = (date?: string, planning?: boolean) => {
  const base = date ? `/daily/${date}` : '/daily';
  return planning ? `${base}?mode=planning` : base;
};
```

## Future Considerations

### Potential Route Extensions

- `/habits` - Dedicated habits management page
- `/integrations` - Integration settings and sync status
- `/reflections` - Historical reflection browser
- `/analytics` - Personal productivity insights

### Mobile Considerations

- All routes are responsive by design
- PWA manifest will handle home screen shortcuts to key routes
- Touch-friendly navigation between dates/weeks

### Accessibility

- All routes support keyboard navigation
- Route changes announce context to screen readers
- Skip links available on all major pages

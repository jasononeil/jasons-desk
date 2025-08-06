# SQLite Database Schema

## Technology

- Use sqlite for the database
- Use drizzle for the ORM

## users
- id (integer, primary key, auto increment)
- username (text, unique, not null)
- password_hash (text, not null)
- created_at (datetime, default current_timestamp)

## categories
- id (integer, primary key, auto increment)
- name (text, unique, not null)
- color (text)
- sort_order (integer, default 0)
- created_at (datetime, default current_timestamp)

## habits
- id (integer, primary key, auto increment)
- name (text, not null)
- frequency_type (text, not null) -- 'daily' or 'weekly'
- frequency_target (integer, default 1) -- times per week for weekly habits
- current_streak (integer, default 0)
- is_active (boolean, default true)
- created_at (datetime, default current_timestamp)

## habit_completions
- id (integer, primary key, auto increment)
- habit_id (integer, foreign key to habits.id)
- completed_date (date, not null)
- created_at (datetime, default current_timestamp)

## tasks
- id (integer, primary key, auto increment)
- title (text, not null)
- notes (text)
- is_completed (boolean, default false)
- is_big_rock (boolean, default false)
- category_id (integer, foreign key to categories.id)
- source_type (text) -- 'local', 'todoist', 'jira'
- source_id (text) -- external ID from source system
- source_url (text) -- link back to original task
- due_date (date)
- completed_at (datetime)
- created_at (datetime, default current_timestamp)
- updated_at (datetime, default current_timestamp)

## task_positions
- id (integer, primary key, auto increment)
- task_id (integer, foreign key to tasks.id)
- view_type (text, not null) -- 'daily', 'weekly', 'backlog'
- position_date (date) -- for daily view, week start date for weekly view
- sort_order (integer, not null)
- section (text) -- 'main', 'triage', etc.
- updated_at (datetime, default current_timestamp)

## reflections
- id (integer, primary key, auto increment)
- reflection_date (date, unique, not null)
- content (text)
- created_at (datetime, default current_timestamp)
- updated_at (datetime, default current_timestamp)

## weekly_goals
- id (integer, primary key, auto increment)
- week_start_date (date, not null) -- Monday of the week
- goal_text (text, not null)
- is_completed (boolean, default false)
- sort_order (integer, default 0)
- created_at (datetime, default current_timestamp)
- updated_at (datetime, default current_timestamp)

## calendar_events
- id (integer, primary key, auto increment)
- external_id (text, unique, not null)
- title (text, not null)
- description (text)
- start_time (datetime, not null)
- end_time (datetime, not null)
- location (text)
- is_all_day (boolean, default false)
- source (text, default 'google') -- for future CalDAV support
- created_at (datetime, default current_timestamp)
- updated_at (datetime, default current_timestamp)

## sync_metadata
- id (integer, primary key, auto increment)
- sync_type (text, unique, not null) -- 'todoist', 'jira', 'google_calendar'
- last_sync_at (datetime)
- sync_token (text) -- for incremental syncing
- created_at (datetime, default current_timestamp)
- updated_at (datetime, default current_timestamp)

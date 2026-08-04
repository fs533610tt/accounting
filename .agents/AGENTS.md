# Table Tennis Team Management System - AI Agent Rules

These rules must be strictly followed by all AI agents operating within this workspace to maintain the established architectural and UX standards.

## Database & SQL Management
1. **Modular SQL Files**: All database schema changes and RLS policies must be written as modular, numbered SQL files stored in the `docs/sql/` directory (e.g., `01_schema.sql`, `02_rls.sql`).
2. **Master Init File**: EVERY TIME a new SQL migration file is created or a schema/RLS is altered, you MUST append the exact same SQL logic to `docs/sql/00_master_init.sql`. This file serves as the single source of truth for creating a fresh database from scratch.
3. **Defensive SQL**: Always use defensive SQL statements (e.g., `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`) to allow scripts to be safely re-run by the user without throwing "already exists" errors.
4. **Multi-Tenant RLS**: When creating new tables, strictly enforce data isolation by tying the table to a `team_id` and implementing Row Level Security (RLS) policies that verify permissions against the `user_roles` table.
5. **Health Checks**: When dealing with complex database migrations, proactively provide "Health Check" SQL queries (like checking `information_schema.columns`) for the user to verify the current schema state in Supabase.

## Frontend UI/UX Guidelines
1. **MOBILE WEB PAGE - MOBILE-FIRST DESIGN IS MANDATORY**: This is strictly a mobile web page application. ALL designs, layouts, and components MUST be optimized for narrow, vertical phone screens first. Never design with desktop width as the primary assumption.
2. **Touch-Friendly UI**: Ensure all buttons, inputs, and interactive elements have sufficient padding and margin to be easily tappable on a touch screen. Avoid cramped layouts with too many buttons squeezed together.
3. **Navigation Structure**: Avoid long, infinitely scrolling pages. For complex management interfaces (like the Dashboard), implement tabbed navigation (`Tabs`) or sidebars to cleanly categorize content (e.g., separating "System Admin", "Roster", and "Billing"). Keep headers compact.
4. **Modern Aesthetics**: Strictly follow the established modern design aesthetic:
   - Dark mode by default
   - Glassmorphism effects (using the existing `.glass-panel` CSS classes)
   - Vibrant accent colors and smooth micro-animations.
   - **Native Element Styling**: ALWAYS explicitly style native HTML form elements (like `<select>`, `<option>`, and `<input>`) with dark backgrounds (e.g., `#1a1a2e` or `rgba(0,0,0,0.8)`) and white text (`color: #fff`) to prevent browser defaults from rendering white text on light gray backgrounds in dark mode.
5. **Button Loading States**: For better UX, any button that triggers an asynchronous operation (especially batch operations like "Apply to Selected") MUST have a loading state to indicate processing. Change the button text (e.g. to "處理中..." or using a spinner) and disable the button while the operation is running.
6. **Horizontal Scrolling for Action Bars & Stats**: To save vertical space on mobile and prevent buttons or stat cards from cramping up and wrapping into multiple lines, always wrap action button groups and statistics cards in a horizontally scrollable container (`display: flex`, `flex-wrap: nowrap`, `overflow-x: auto`). Hide the scrollbar visually using the global `.scrollable-container` class.

---
🚨 **CRITICAL UI RULE (VIOLATED 3 TIMES - DO NOT IGNORE)** 🚨
**ABSOLUTELY NO HTML `<table>` ELEMENTS FOR DATA LISTS.**
- **Why?** Tables are notoriously terrible for mobile responsiveness.
- **What to use instead?** You MUST use a **"Card View" (卡片式)** grid layout (`display: grid` with `minmax`) for all data lists (e.g., student rosters, billing details, attendance records).
- **Punishment for violation**: Fails the core requirement of "Mobile-First Data Display". NEVER USE `<table className="table-responsive">`. EVER.
---

## Domain Context
- This system is a multi-tenant SaaS application designed specifically for table tennis teams. Any new feature should be designed with this multi-tenant context in mind.

## AI Assistant Persona & Communication Style
1. **Enthusiastic & Encouraging**: Always maintain a highly positive, encouraging, and energetic tone. Use emojis naturally to make the conversation engaging and less robotic.
2. **Explain the "Why"**: Don't just provide code. Explain the rationale behind architectural decisions (e.g., why a certain CSS layout was chosen, why a database policy was designed a certain way) so the user learns and feels involved in the process.
3. **Proactive Partnership**: Anticipate the user's next needs. If a feature is finished, proactively suggest or prepare for the next logical phase (like moving from Billing straight to Print Envelopes).
4. **Clear Action Items**: When giving the user instructions (like running terminal commands, clicking buttons, or executing SQL), break them down into clear, numbered, step-by-step lists with bold text for emphasis.
5. **Language**: Communicate using Traditional Chinese (zh-TW) tailored to Taiwanese terminology and phrasing.

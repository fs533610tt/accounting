# Table Tennis Team Management System - AI Agent Rules

These rules must be strictly followed by all AI agents operating within this workspace to maintain the established architectural and UX standards.

## Database & SQL Management
1. **Modular SQL Files**: All database schema changes and RLS policies must be written as modular, numbered SQL files stored in the `docs/sql/` directory (e.g., `01_schema.sql`, `02_rls.sql`).
2. **Defensive SQL**: Always use defensive SQL statements (e.g., `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`) to allow scripts to be safely re-run by the user without throwing "already exists" errors.
3. **Multi-Tenant RLS**: When creating new tables, strictly enforce data isolation by tying the table to a `team_id` and implementing Row Level Security (RLS) policies that verify permissions against the `user_roles` table.
4. **Health Checks**: When dealing with complex database migrations, proactively provide "Health Check" SQL queries (like checking `information_schema.columns`) for the user to verify the current schema state in Supabase.

## Frontend UI/UX Guidelines
1. **Navigation Structure**: Avoid long, infinitely scrolling pages. For complex management interfaces (like the Dashboard), implement tabbed navigation (`Tabs`) or sidebars to cleanly categorize content (e.g., separating "System Admin", "Roster", and "Billing").
2. **Modern Aesthetics**: Strictly follow the established modern design aesthetic:
   - Dark mode by default
   - Glassmorphism effects (using the existing `.glass-panel` CSS classes)
   - Vibrant accent colors and smooth micro-animations.

## Domain Context
- This system is a multi-tenant SaaS application designed specifically for table tennis teams. Any new feature should be designed with this multi-tenant context in mind.

## AI Assistant Persona & Communication Style
1. **Enthusiastic & Encouraging**: Always maintain a highly positive, encouraging, and energetic tone. Use emojis naturally to make the conversation engaging and less robotic.
2. **Explain the "Why"**: Don't just provide code. Explain the rationale behind architectural decisions (e.g., why a certain CSS layout was chosen, why a database policy was designed a certain way) so the user learns and feels involved in the process.
3. **Proactive Partnership**: Anticipate the user's next needs. If a feature is finished, proactively suggest or prepare for the next logical phase (like moving from Billing straight to Print Envelopes).
4. **Clear Action Items**: When giving the user instructions (like running terminal commands, clicking buttons, or executing SQL), break them down into clear, numbered, step-by-step lists with bold text for emphasis.
5. **Language**: Communicate using Traditional Chinese (zh-TW) tailored to Taiwanese terminology and phrasing.

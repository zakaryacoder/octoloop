# OCTOLOOP — Design System (frozen)

## Colors (exact hex)
- Navy (primary): `#12304A` — sidebar bg, primary buttons, headers
- Teal (accent): `#13A89E` — highlights, success accents, active states
- Background: `#F5F8FB` — app background
- Cards: `#FFFFFF` with soft shadow `0 1px 3px rgba(18,48,74,0.08), 0 4px 12px rgba(18,48,74,0.06)`
- Text: slate — headings `#0F2537`, body `#334155`, muted `#64748B`
- Borders: `#E2E8F0`
- Status palette (badges):
  - success/closed/normal: teal `#13A89E` (bg `#E6F6F5`)
  - warning/pending/overdue-soon: amber `#D97706` (bg `#FEF3C7`)
  - danger/overdue/abnormal/rejected: red `#DC2626` (bg `#FEE2E2`)
  - info/in-progress: blue `#2563EB` (bg `#DBEAFE`)
  - neutral/awaiting: slate `#64748B` (bg `#F1F5F9`)
  - urgent: `#7C3AED` (bg `#EDE9FE`)

## Typography
- Font stack: `Inter, "SF Pro Display", -apple-system, "Segoe UI", Roboto, sans-serif` (slate/professional). Headings tracking `-0.01em`, weight 600-700. Body 14-15px, line-height 1.55.
- Numeric KPIs: tabular-nums, 28px semibold navy.

## Layout
- Sidebar: 260px, navy `#12304A` bg, white text, teal active item indicator (left bar + subtle teal tint). Collapsible on mobile to drawer.
- Top bar: white, 64px, with search input, notification bell (with unread badge), user avatar/menu.
- Content: max-width fluid, padding 24px, grid gap 20px. Cards `rounded-xl` (12px), padding 20-24px.
- Radius: cards 12px, buttons 8px, inputs 8px, badges full-pill.

## Components (shadcn/ui + Tailwind)
- Buttons: primary = navy bg white text hover `#0E263B`; secondary = white border slate; accent = teal.
- Tables: sticky header, row hover `#F8FAFC`, zebra off, filter row above with search + select filters + date range. Empty state: icon + text + CTA. Loading: skeleton rows.
- Status badges: pill with dot, mapped from palette above.
- Charts (Recharts): navy/teal/amber palette, grid `#EEF2F7`, no border, tooltips white card shadow.
- Case timeline: vertical stepper, each node = case event, color-coded by event type, current status highlighted with teal pulse.
- Modals: shadcn Dialog, 8px radius, overlay `rgba(15,37,55,0.45)`.
- Forms: React Hook Form + Zod, inline error text red, labels 13px semibold slate.
- Animations: 150-200ms ease, fade/slide-in on mount; no excessive motion. Respect `prefers-reduced-motion`.

## Pages (frontend routes, `/app` router)
- `/login`
- `/` (dashboard command center)
- `/patients`, `/patients/[id]`
- `/screenings`
- `/cases`, `/cases/[id]` (with interactive timeline)
- `/referrals`
- `/appointments`
- `/notifications`
- `/analytics`
- `/admin` (users, audit logs, escalation rules, settings tabs)

## API client
- `lib/api.ts`: fetch wrapper, base URL from `NEXT_PUBLIC_API_URL` (default `http://localhost:8000/api/v1`), attaches JWT from localStorage, 401 → redirect to /login.
- All pages fetch real API endpoints; no static mock data. Loading/empty/error states required.

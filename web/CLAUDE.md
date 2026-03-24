# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also: `../CLAUDE.md` for project-wide overview, design system, and database runbook.

## Commands

```bash
npm run dev      # Dev server on localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

## Next.js Version Warning

This project uses **Next.js 16.2.1** which has breaking changes from older versions. Before writing any code, check `node_modules/next/dist/docs/` for current APIs. Do not assume APIs from your training data are correct.

## Architecture

### Three Supabase Clients

The app uses three distinct Supabase clients — choosing the wrong one causes auth failures or RLS bypasses:

| Client | File | Use When |
|--------|------|----------|
| **Browser** | `src/lib/supabase.ts` (`createBrowserClient`) | Client components needing auth context |
| **Server** | `src/lib/supabase-server.ts` (`createServerClient`) | Server components and server actions for authenticated user reads (respects RLS) |
| **Admin** | `src/lib/supabase-admin.ts` (`createClient` with service role key) | Server actions only — bypasses RLS for admin CRUD, approvals, and awarding points |

Never import the admin client in client components or expose it outside `'use server'` actions.

### Middleware / Auth

`src/proxy.ts` exports the middleware function (not `middleware.ts` — it's imported via next config or middleware file). It:
- Refreshes the Supabase session on every request
- Redirects unauthenticated users from `/dashboard/*` and `/profile/*` to `/login`
- Redirects non-admin users from `/admin/*` to `/`
- Redirects logged-in users from `/login` and `/register` to `/dashboard`

Admin role is stored in `user.app_metadata.role === 'admin'` (set via SQL, not the app).

### Server Actions

All server actions live in `src/app/actions/auth.ts` (plus `src/app/admin/events/actions.ts` for event CRUD). Actions follow this pattern:

```typescript
// Signature expected by useActionState
export async function actionName(prevState: { error: string; success?: boolean }, formData: FormData) {
  // ... validate, call supabase
  revalidatePath('/relevant-path')
  return { error: '', success: true }
}
```

Admin actions use `createAdminClient()`, user actions use `createClient()` from `supabase-server.ts`.

### Form Handling

Forms use React 19's `useActionState` hook (not the deprecated `useFormState`):

```typescript
const [state, formAction, pending] = useActionState(serverAction, { error: '' })
```

Loading states use `useTransition` for non-form async operations.

### Request Approval Workflow

1. Users submit requests at `/dashboard/request` → inserts into `requests` (venue/organizer) or `event_requests` (events)
2. Admins review at `/admin/requests` with status/type filters
3. `ApproveModal` lets admins edit fields before approving — the action simultaneously updates request status AND inserts into the main table (`venues`/`organizers`/`events`)
4. Points are awarded on approval: 2 pts for venue/organizer, 5 pts for event
5. Rank system: Rookie (0) → Explorer (10) → Scout (25) → Insider (50) → Legend (100), tracked in `user_points` table

### Modal Pattern

Modals render via `createPortal(modal, document.body)`. Components: `ApproveModal.tsx`, `RejectModal.tsx` (shared), plus inline modal state in `VenueManager`, `OrganizerManager`, `EventsClient`.

### Route Structure

- **Public:** `/` (event grid, ISR 60s), `/login`, `/register`
- **User (auth required):** `/dashboard`, `/dashboard/request`, `/profile`
- **Admin (admin role required):** `/admin`, `/admin/requests`, `/admin/venues`, `/admin/organizers`, `/admin/events`
- **API:** `/api/auth/callback` (Supabase OAuth code exchange)

Admin pages have their own layout (`src/app/admin/layout.tsx`) with sidebar navigation that re-checks admin role defensively.

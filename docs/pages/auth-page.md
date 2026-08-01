# Admin Auth Page

## Route
- Public route: `/auth`
- Implementation: [src/routes/auth.tsx](src/routes/auth.tsx)

## Purpose
This page provides admin sign-in for authorized users. It resolves the admin identifier to an email and signs the user into Supabase auth.

## What the user sees
- Admin ID/email input
- Password input
- Sign-in button
- Link back to the home page

## Key behaviors
- The page checks whether the current Supabase session already exists and redirects to the dashboard when present.
- It uses `resolveLoginEmail` from [src/lib/super-admin.functions.ts](src/lib/super-admin.functions.ts) to map an admin ID to an email address.
- On successful sign-in, the app redirects to the dashboard or a `next` path from the query string.

## Important implementation notes
- The page accepts either an admin ID such as `ADM-XXXXXX` or an email address.
- The route uses a `validateSearch` rule to ensure `next` is a safe internal path.

## Data flow
1. User enters identity and password.
2. The page resolves the identifier through the server function.
3. Supabase Auth signs the user in.
4. The app redirects to the authenticated workspace.

## Security notes
- Only users who later pass the authenticated role guard are permitted into the admin area.
- New admin accounts are created only by a super admin through the admins page.

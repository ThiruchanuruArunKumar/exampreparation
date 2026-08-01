# Roles and Access Model

## Roles
- Student: Can join a public exam, take it, and view results for their own attempt.
- Admin: Can manage exams, drafts, students, and reporting.
- Super admin: Can perform elevated administrative actions beyond the standard admin scope.

## Access patterns
- Public routes are available without authentication for students and parents.
- Authenticated routes are protected by role-based guards in the route tree.
- Sensitive management pages are only reachable by privileged admin roles.

## Important implementation notes
- The route tree in [../../src/routes](../../src/routes) defines which areas belong to authenticated admin pages and which remain public.
- The auth layer in [../../src/hooks/useAuth.ts](../../src/hooks/useAuth.ts) and the server helpers in [../../src/lib/admin.functions.ts](../../src/lib/admin.functions.ts) govern this distinction.

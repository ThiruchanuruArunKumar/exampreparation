# Admins Page

## Route
- Authenticated route: `/admins`
- Implementation: [../../src/routes/_authenticated/admins.tsx](../../src/routes/_authenticated/admins.tsx)

## Purpose
This page manages administrator accounts and their access. It supports listing admins and changing who has privileged access.

## What the user sees
- A list of admin accounts
- Controls to create or remove admin access

## Key behaviors
- It loads admin records from the backend.
- It allows server-side updates to keep the admin roster in sync.

## Important implementation notes
- This is a privileged administrative area and should only be reachable to authorized roles.

## Data flow
1. The page loads the admin list.
2. Admin actions update the role or access table.
3. The change becomes immediately reflected in the authenticated app shell.

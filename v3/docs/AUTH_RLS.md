# Auth and RLS V3

## Account lifecycle

There is no public signup route. An active `admin` may create student, parent, or
teacher accounts in their own school. Only `direction` may create an `admin` or
another `direction` account. New accounts start as `pending` and are activated by
an audited server operation.

The first direction is created once with `npm run bootstrap:direction`. The
service-role RPC refuses every later bootstrap attempt; no name, class, or
password is embedded in source code.

Passwords are sent directly to Supabase Auth over the server-side Admin API. They
never enter a public or private business table. Login aliases are stored in the
private schema and resolved only by a service-role RPC. Roles are read from
`user_roles`; browser storage and Auth user metadata are not authorization inputs.

## Status behavior

| Status | Access |
| --- | --- |
| pending | No business access; activation message after valid credentials |
| active | Access determined by roles, relationships, and RLS |
| suspended | Class/learning scope stops; own account record remains readable |
| archived | Class/learning scope stops; historical references are retained |

## Roles

- `student`: own profile and own future learning records only.
- `parent`: own profile and explicitly linked children.
- `teacher`: only active students and classes in active assignments.
- `admin`: school-scoped management through an active school membership.
- `direction`: cross-school administration and privileged role creation.

## Installed select policies

- `profiles_select_own`
- `profiles_select_scoped`
- `user_roles_select_own`
- `user_roles_select_administration`
- `audit_logs_select_administration`
- `schools_select_member`
- `school_memberships_select_scoped`
- `student_profiles_select_scoped`
- `parent_profiles_select_self_or_admin`
- `teacher_profiles_select_self_or_admin`
- `admin_profiles_select_self_or_direction`
- `family_relationships_select_scoped`
- `classes_select_scoped`
- `class_enrollments_select_scoped`
- `class_teacher_assignments_select_scoped`

Authenticated and anonymous roles receive no direct `insert`, `update`, or
`delete` privilege on these tables. Account provisioning and status changes are
service-role RPCs with an independent actor-role check and an audit event.

## Scope functions

`can_access_student(student_id)` permits only self, an active linked parent, an
actively assigned teacher, a school-scoped admin, or direction. The function is
`security definer`, has a fixed search path, and is used inside RLS so filtering
cannot be bypassed by changing the UI.

`can_access_class(class_id)` checks active enrolment, active parent-child link,
active teacher assignment, or school administration. `can_manage_user(user_id)`
ensures ordinary admins remain limited to users attached to their own school.

## Login enumeration resistance

Unknown aliases still trigger a Supabase Auth password attempt against an opaque
nonexistent identity. The API returns the same Arabic credentials message for an
unknown alias and a wrong password. Pending and suspended messages are returned
only after valid credentials have established account ownership.

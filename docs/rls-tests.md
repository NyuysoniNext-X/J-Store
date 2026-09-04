# RLS Test Scenarios — J-STORE.cm

Manual test recipes for `profiles` and `user_roles`. Run as SQL in the Supabase SQL editor or via the app while signed in as the relevant user.

## profiles

| Scenario                                   | Expected                 |
| ------------------------------------------ | ------------------------ |
| Signed-in user `select` own row            | ✅ row returned          |
| Signed-in user `select` another user's row | ✅ 0 rows (RLS hides it) |
| Signed-in user `update` own `phone`        | ✅ success               |
| Signed-in user `update` another user's row | ❌ 0 rows affected       |
| Anonymous `select * from profiles`         | ❌ permission denied     |

## user_roles

| Scenario                                            | Expected                                            |
| --------------------------------------------------- | --------------------------------------------------- |
| User self-`insert` `{role:'seller'}` for themselves | ✅ allowed (self-assign policy)                     |
| User self-`insert` `{role:'admin'}` for themselves  | ❌ violates RLS — admin must be granted by an admin |
| User `insert` a role for another `user_id`          | ❌ violates RLS                                     |
| User `delete` own `seller` role                     | ✅ allowed                                          |
| User `delete` own `admin` role                      | ❌ violates RLS (admin-only)                        |
| Admin `select` all rows                             | ✅ via `has_role(auth.uid(),'admin')`               |
| Non-admin `select` another user's roles             | ❌ 0 rows                                           |

## has_role()

`has_role(uid, 'admin'::app_role)` must be callable inside policies without triggering recursion. Verified by the `Admins can view all roles` policy on `user_roles` itself — selecting that table from inside the function uses `SECURITY DEFINER` to bypass RLS.

## Suggested manual run

```sql
-- as authenticated user (replace UUIDs):
select * from public.profiles;                              -- only your row
insert into public.user_roles(user_id, role)
  values (auth.uid(), 'seller');                            -- ok
insert into public.user_roles(user_id, role)
  values (auth.uid(), 'admin');                             -- error
delete from public.user_roles
  where user_id = auth.uid() and role = 'seller';           -- ok
```

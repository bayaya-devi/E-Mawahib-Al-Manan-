-- Separate legacy student and teacher aliases so identical names cannot cross roles.
update private.login_aliases alias
set normalized_alias = case
  when exists (select 1 from public.user_roles role where role.user_id = alias.user_id and role.role = 'student')
    then 's_' || alias.normalized_alias
  when exists (select 1 from public.user_roles role where role.user_id = alias.user_id and role.role in ('teacher', 'admin', 'direction'))
    then 't_' || alias.normalized_alias
  else alias.normalized_alias
end
where alias.normalized_alias !~ '^[st]_';

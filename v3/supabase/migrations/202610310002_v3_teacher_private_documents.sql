-- Teacher documents are private. Access is brokered by an authenticated API route
-- after the teacher_documents RLS policy has authorized the metadata row.
do $$
begin
  -- Local PostgreSQL/PGlite test databases do not ship the Supabase Storage schema.
  if to_regclass('storage.buckets') is not null then
    execute $storage$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values (
        'teacher-documents',
        'teacher-documents',
        false,
        10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      )
      on conflict (id) do update set
        public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types
    $storage$;
  end if;
end;
$$;

drop policy if exists school_documents_related_user_read on public.school_documents;
create policy school_documents_related_user_read
on public.school_documents for select to authenticated
using (related_user_id = auth.uid() and visible_to_related_user = true);

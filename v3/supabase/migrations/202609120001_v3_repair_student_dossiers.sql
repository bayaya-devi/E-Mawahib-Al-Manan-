begin;

-- Recover the files missing from historical partial account creations.
insert into public.student_digital_files (
  student_id,
  school_id,
  payment_required,
  monthly_fee,
  identity_document_received,
  birth_certificate_received,
  guardian_identity_received,
  updated_by
)
select
  student.user_id,
  membership.school_id,
  true,
  0,
  false,
  false,
  false,
  student.user_id
from public.student_profiles student
join public.school_memberships membership
  on membership.user_id = student.user_id
 and membership.status = 'active'
left join public.student_digital_files file
  on file.student_id = student.user_id
where file.student_id is null
on conflict (student_id) do nothing;

commit;

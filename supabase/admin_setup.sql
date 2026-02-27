-- ============================================================
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create vehicle-images bucket (public so images load on the site)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-images',
  'vehicle-images',
  true,
  20971520, -- 20MB per image
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 2. Allow admins to upload vehicle images
create policy "Admins can upload vehicle images"
  on storage.objects for insert
  with check (
    bucket_id = 'vehicle-images' and
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- 3. Anyone can view vehicle images (public bucket)
create policy "Public can view vehicle images"
  on storage.objects for select
  using (bucket_id = 'vehicle-images');

-- ============================================================
-- IMPORTANT: Make yourself admin
-- Replace the email below with YOUR email address
-- ============================================================
update public.users
set role = 'admin'
where id = (
  select id from auth.users where email = 'YOUR_EMAIL_HERE'
);

-- Verify it worked — should return your account with role = admin
select u.id, u.full_name, u.role, au.email
from public.users u
join auth.users au on au.id = u.id
where u.role = 'admin';

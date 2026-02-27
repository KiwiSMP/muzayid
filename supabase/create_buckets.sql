-- Run this in Supabase SQL Editor to create required storage buckets

-- National ID bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'national-ids',
  'national-ids',
  false,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Deposit receipts bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deposit-receipts',
  'deposit-receipts',
  false,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- RLS policies for national-ids
create policy "Users can upload their own national ID"
  on storage.objects for insert
  with check (bucket_id = 'national-ids' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view their own national ID"
  on storage.objects for select
  using (bucket_id = 'national-ids' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Admins can view all national IDs"
  on storage.objects for select
  using (bucket_id = 'national-ids' and exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  ));

-- RLS policies for deposit-receipts
create policy "Users can upload their own deposit receipt"
  on storage.objects for insert
  with check (bucket_id = 'deposit-receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view their own deposit receipt"
  on storage.objects for select
  using (bucket_id = 'deposit-receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Admins can view all deposit receipts"
  on storage.objects for select
  using (bucket_id = 'deposit-receipts' and exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  ));

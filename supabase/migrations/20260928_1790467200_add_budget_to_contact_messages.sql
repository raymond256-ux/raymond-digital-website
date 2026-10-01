-- RAYMOND DIGITAL | ICT & BUSINESS SOLUTIONS
-- Additive migration: store the optional estimated budget selected on the
-- website enquiry forms. Existing rows keep a NULL/absent budget value.
-- No changes to RLS, existing columns, or other tables.

alter table public.contact_messages
  add column if not exists budget text;
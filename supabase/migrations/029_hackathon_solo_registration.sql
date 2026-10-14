-- The public form permits solo registration. The original constraint rejected
-- it after the provider had already collected payment. Preserve historical
-- five-person teams while allowing the current one-to-four-person form.
begin;
alter table public.hackathon_registrations
  drop constraint if exists hackathon_registrations_team_size_check;
alter table public.hackathon_registrations
  add constraint hackathon_registrations_team_size_check
  check (team_size >= 1 and team_size <= 5);
commit;

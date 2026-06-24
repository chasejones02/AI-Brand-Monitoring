-- Anonymous sign-in support.
--
-- Free scans no longer require a login: the frontend calls
-- supabase.auth.signInAnonymously(), which inserts an auth.users row with a
-- NULL email. The original handle_new_user() trigger inserted new.email
-- straight into profiles.email (NOT NULL), so an anonymous sign-up would fail
-- the constraint and abort the whole sign-in. Coalesce to '' instead.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Keep profiles.email in sync when the auth email changes. This matters for
-- "convert in place": when an anonymous user upgrades, the frontend calls
-- updateUser({ email }) which updates auth.users.email but not profiles.email.
-- Stripe checkout (backend/routes/stripe.ts) reads profiles.email to stamp the
-- customer, so without this sync the upgraded customer would have no email.
create or replace function public.handle_user_email_update()
returns trigger as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
      set email = coalesce(new.email, '')
      where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update on auth.users
  for each row execute procedure public.handle_user_email_update();

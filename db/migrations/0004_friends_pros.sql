-- PolyRunner: Friends and Pros sections, user-created markets.

alter table athletes
  add column category text not null default 'friend' check (category in ('friend', 'pro'));

alter table markets add column created_by uuid references users (id) on delete set null;

-- Everyone who already connected Strava becomes a friend athlete.
insert into athletes (name, user_id, category)
select coalesce(s.display_name, u.username), u.id, 'friend'
  from strava_accounts s
  join users u on u.id = s.user_id
 where not exists (select 1 from athletes a where a.user_id = u.id);

-- PolyRunner: settings editable from the admin page (e.g. Strava app credentials).

create table app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Demo data: three races and a group of friends.
-- Loaded automatically on first deploy when SEED_DEMO=true (see scripts/migrate.mjs).

do $$
declare
  v_milano uuid;
  v_stramilano uuid;
  v_parco uuid;
  v_marco uuid;
  v_giulia uuid;
  v_luca uuid;
  v_sara uuid;
  v_nicco uuid;
begin
  insert into races (name, starts_at, distance_km, location)
  values ('Milano Marathon 2027', '2027-04-11 09:00:00+02', 42.195, 'Milan')
  returning id into v_milano;

  insert into races (name, starts_at, distance_km, location)
  values ('Stramilano Half 2027', '2027-03-21 09:30:00+01', 21.097, 'Milan')
  returning id into v_stramilano;

  insert into races (name, starts_at, distance_km, location)
  values ('10K in the Park', '2026-12-13 10:00:00+01', 10, 'Sempione Park')
  returning id into v_parco;

  insert into athletes (name, personal_best_seconds, bio)
  values ('Marco', 12600, 'Weekend marathoner, PB 3:30:00') returning id into v_marco;
  insert into athletes (name, personal_best_seconds, bio)
  values ('Giulia', 11400, 'Former middle-distance runner, PB 3:10:00') returning id into v_giulia;
  insert into athletes (name, personal_best_seconds, bio)
  values ('Luca', 14400, 'First marathon, plenty of confidence') returning id into v_luca;
  insert into athletes (name, personal_best_seconds, bio)
  values ('Sara', 5700, 'Half marathon specialist, PB 1:35:00') returning id into v_sara;
  insert into athletes (name, personal_best_seconds, bio)
  values ('Nicco', 2580, 'Fast over 10K, PB 43:00') returning id into v_nicco;

  perform create_market(v_milano, v_marco, 100, null, '[
    {"label": "< 3:15:00", "min_seconds": null, "max_seconds": 11700, "prob": 0.10},
    {"label": "3:15:00 - 3:30:00", "min_seconds": 11700, "max_seconds": 12600, "prob": 0.30},
    {"label": "3:30:00 - 3:45:00", "min_seconds": 12600, "max_seconds": 13500, "prob": 0.40},
    {"label": "> 3:45:00", "min_seconds": 13500, "max_seconds": null, "prob": 0.20}
  ]'::jsonb);

  perform create_market(v_milano, v_giulia, 100, null, '[
    {"label": "< 3:00:00", "min_seconds": null, "max_seconds": 10800, "prob": 0.15},
    {"label": "3:00:00 - 3:10:00", "min_seconds": 10800, "max_seconds": 11400, "prob": 0.45},
    {"label": "3:10:00 - 3:20:00", "min_seconds": 11400, "max_seconds": 12000, "prob": 0.30},
    {"label": "> 3:20:00", "min_seconds": 12000, "max_seconds": null, "prob": 0.10}
  ]'::jsonb);

  perform create_market(v_milano, v_luca, 100, null, '[
    {"label": "< 3:45:00", "min_seconds": null, "max_seconds": 13500},
    {"label": "3:45:00 - 4:00:00", "min_seconds": 13500, "max_seconds": 14400},
    {"label": "4:00:00 - 4:30:00", "min_seconds": 14400, "max_seconds": 16200},
    {"label": "> 4:30:00", "min_seconds": 16200, "max_seconds": null}
  ]'::jsonb);

  perform create_market(v_stramilano, v_sara, 100, null, '[
    {"label": "< 1:30:00", "min_seconds": null, "max_seconds": 5400, "prob": 0.15},
    {"label": "1:30:00 - 1:35:00", "min_seconds": 5400, "max_seconds": 5700, "prob": 0.40},
    {"label": "1:35:00 - 1:40:00", "min_seconds": 5700, "max_seconds": 6000, "prob": 0.30},
    {"label": "> 1:40:00", "min_seconds": 6000, "max_seconds": null, "prob": 0.15}
  ]'::jsonb);

  perform create_market(v_parco, v_nicco, 100, null, '[
    {"label": "< 42:00", "min_seconds": null, "max_seconds": 2520, "prob": 0.25},
    {"label": "42:00 - 44:00", "min_seconds": 2520, "max_seconds": 2640, "prob": 0.45},
    {"label": "44:00 - 46:00", "min_seconds": 2640, "max_seconds": 2760, "prob": 0.20},
    {"label": "> 46:00", "min_seconds": 2760, "max_seconds": null, "prob": 0.10}
  ]'::jsonb);

  perform create_custom_market(v_milano, v_luca, 'Will Luca stop to walk at any point?', 100, null, 0.6);
  perform create_custom_market(v_milano, v_marco, 'Will Marco finish ahead of Giulia?', 100, null, 0.3);
end;
$$;

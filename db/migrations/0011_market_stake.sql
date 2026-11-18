-- Markets can be staked in virtual credits or beers (same wallet, different label).
alter table markets
  add column stake text not null default 'credits'
  check (stake in ('credits', 'beer'));

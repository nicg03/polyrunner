import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "us-west2" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-west2", sizeMB: 5000 });
  const web = service("web", {
    source: github("nicg03/polyrunner", { checkSuites: false }),
    replicas: { "us-west2": 1 },
    preDeploy: "node scripts/migrate.mjs",
    start: "npm start",
    variables: {
      DATABASE_URL: Postgres.env.DATABASE_URL,
      SEED_DEMO: "true",
      APP_URL: "https://web-production-dd376083.up.railway.app",
      // Set from the Strava app settings with `railway variables --set`; kept out of the repo.
      STRAVA_CLIENT_ID: preserve(),
      STRAVA_CLIENT_SECRET: preserve(),
    },
  });

  return project("polyrunner", {
    resources: [Postgres, web, postgresVolume],
  });
});

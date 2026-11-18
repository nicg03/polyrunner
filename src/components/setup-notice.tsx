export function SetupNotice() {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-xl border bg-card p-6 text-sm">
      <h2 className="mb-2 text-lg font-semibold">Set up the database</h2>
      <p className="text-muted-foreground">
        Set <code>DATABASE_URL</code> to your Postgres connection string (locally in{" "}
        <code>.env.local</code>), then run <code>npm run db:migrate</code>. See the README for
        all the steps.
      </p>
    </div>
  );
}

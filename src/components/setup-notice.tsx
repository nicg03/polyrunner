export function SetupNotice() {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-xl border bg-card p-6 text-sm">
      <h2 className="mb-2 text-lg font-semibold">Configura il database</h2>
      <p className="text-muted-foreground">
        Imposta <code>DATABASE_URL</code> con la stringa di connessione Postgres (in locale in{" "}
        <code>.env.local</code>), poi esegui <code>npm run db:migrate</code>. Trovi tutti i
        passaggi nel README.
      </p>
    </div>
  );
}

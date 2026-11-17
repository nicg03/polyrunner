export function SetupNotice() {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-xl border bg-card p-6 text-sm">
      <h2 className="mb-2 text-lg font-semibold">Configura Supabase</h2>
      <p className="text-muted-foreground">
        Copia <code>.env.example</code> in <code>.env.local</code> e inserisci{" "}
        <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
        del tuo progetto Supabase, poi esegui la migration in{" "}
        <code>supabase/migrations</code>. Trovi tutti i passaggi nel README.
      </p>
    </div>
  );
}

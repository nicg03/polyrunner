import { Suspense } from "react";
import { StravaButton } from "@/components/strava-card";
import { isStravaConfigured } from "@/lib/strava";
import { LoginForm } from "./login-form";

export const metadata = { title: "Accedi · PolyRunner" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const stravaEnabled = await isStravaConfigured();
  const connectHref = `/api/strava/connect${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Entra in PolyRunner</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {stravaEnabled
            ? "Accedi con Strava: niente password. Ricevi 1.000 crediti virtuali (non trasferibili né convertibili in denaro)."
            : "Registrati con email e password. Ricevi 1.000 crediti virtuali (non trasferibili né convertibili in denaro)."}
        </p>
      </div>

      {stravaEnabled && (
        <>
          <StravaButton href={connectHref} className="h-12 w-full text-base">
            Continua con Strava
          </StravaButton>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            oppure con email
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}

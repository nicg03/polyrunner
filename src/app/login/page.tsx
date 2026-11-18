import { Suspense } from "react";
import { StravaButton } from "@/components/strava-card";
import { isStravaConfigured } from "@/lib/strava";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in · PolyRunner" };

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
        <h1 className="text-2xl font-semibold">Join PolyRunner</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {stravaEnabled
            ? "Sign in with your Strava account: no password needed. You get 1,000 virtual credits when you join."
            : "Sign up with your email and a password. You get 1,000 virtual credits when you join."}
        </p>
      </div>

      {stravaEnabled && (
        <>
          <StravaButton href={connectHref} className="h-12 w-full text-base">
            Continue with Strava
          </StravaButton>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or use your email
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

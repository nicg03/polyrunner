import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Log in · PolyRunner" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Join PolyRunner</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a username and a password. You get 1,000 virtual credits when
          you sign up.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}

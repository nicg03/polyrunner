import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Accedi · PolyRunner" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Entra in PolyRunner</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ti mandiamo un link magico via email. Alla prima registrazione ricevi
          1000 crediti virtuali.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}

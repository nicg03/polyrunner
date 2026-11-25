"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { captureReferral, login, register } from "@/actions/auth";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const ref = searchParams.get("ref") ?? "";
  const [mode, setMode] = useState<"login" | "register">(ref ? "register" : "login");

  useEffect(() => {
    if (ref) void captureReferral(ref);
  }, [ref]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {ref && (
          <p className="rounded-lg bg-yes/10 px-3 py-2 text-sm text-yes">
            Invito attivo: tu e chi ti ha invitato riceverete +200 crediti al primo pronostico.
          </p>
        )}
        <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md py-1.5 font-medium transition-colors",
                mode === m ? "bg-background text-foreground" : "text-muted-foreground",
              )}
            >
              {m === "login" ? "Accedi" : "Registrati"}
            </button>
          ))}
        </div>

        <ActionForm
          key={mode}
          action={mode === "login" ? login : register}
          resetOnSuccess={false}
          className="flex flex-col gap-4"
        >
          {(pending) => (
            <>
              <input type="hidden" name="next" value={next} />
              <input type="hidden" name="ref" value={ref} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type={mode === "register" ? "email" : "text"}
                  required
                  autoComplete={mode === "login" ? "username" : "email"}
                  placeholder="tu@email.com"
                />
              </div>
              {mode === "register" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    required
                    autoComplete="nickname"
                    placeholder="es. gazelle_92"
                    maxLength={24}
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Attendi..." : mode === "login" ? "Accedi" : "Crea account"}
              </Button>
            </>
          )}
        </ActionForm>
      </CardContent>
    </Card>
  );
}

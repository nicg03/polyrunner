"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        data: username ? { username } : undefined,
      },
    });

    if (error) {
      setError(error.message);
      setStatus("idle");
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <Mail className="size-8 text-primary" />
          <p className="font-medium">Controlla la tua email</p>
          <p className="text-sm text-muted-foreground">
            Abbiamo inviato un link di accesso a <b>{email}</b>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="tu@esempio.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">
              Nickname{" "}
              <span className="text-muted-foreground">(solo al primo accesso)</span>
            </Label>
            <Input
              id="username"
              placeholder="es. gazzella_92"
              maxLength={24}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-no">{error}</p>}
          <Button type="submit" size="lg" disabled={status === "sending"}>
            {status === "sending" ? "Invio in corso..." : "Inviami il link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

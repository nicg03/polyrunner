"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { registerStravaWebhook, saveStravaSetup } from "@/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StravaSetupStatus } from "@/lib/strava";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 truncate">{value}</code>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-4 text-yes" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

function CredentialsForm() {
  // Controlled so a rejected attempt doesn't wipe what was pasted.
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  return (
    <ActionForm action={saveStravaSetup} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
      {(pending) => (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>Client ID</Label>
            <Input
              name="client_id"
              required
              inputMode="numeric"
              placeholder="123456"
              value={clientId}
              onChange={(e) => setClientId(e.target.value.trim())}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Client Secret</Label>
            <Input
              name="client_secret"
              required
              type="password"
              autoComplete="off"
              placeholder="Click “show” on Strava and paste it here"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value.trim())}
            />
          </div>
          <Button type="submit" disabled={pending} className="bg-[#fc5200] text-white hover:bg-[#e34a00]">
            {pending ? "Checking..." : "Connect Strava"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function StravaSetup({ status, origin }: { status: StravaSetupStatus; origin: string }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const domain = new URL(origin).hostname;

  if (status.source) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="flex items-center gap-2">
          <Check className="size-4 text-yes" />
          Strava is connected (app {status.clientId}). Friends can sign in with Strava from the login page.
        </p>
        {status.webhook === "missing" && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-no/40 bg-no/10 px-3 py-2">
            <span className="flex-1">Automatic activity updates are off: new runs won&apos;t show up by themselves.</span>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await registerStravaWebhook();
                  if (res?.error) toast.error(res.error);
                  else if (res?.ok) toast.success(res.ok);
                })
              }
            >
              Turn on
            </Button>
          </div>
        )}
        {status.webhook === "unknown" && (
          <p className="text-muted-foreground">Could not reach Strava to check activity updates.</p>
        )}
        {status.source === "env" ? (
          <p className="text-xs text-muted-foreground">Credentials come from the server environment variables.</p>
        ) : editing ? (
          <CredentialsForm />
        ) : (
          <button type="button" className="self-start text-xs text-muted-foreground underline" onClick={() => setEditing(true)}>
            Change Strava app credentials
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-muted-foreground">
        One-time setup so friends can sign in with Strava and their race times can be verified. It
        takes about two minutes.
      </p>
      <ol className="flex list-decimal flex-col gap-3 pl-5">
        <li>
          <a
            href="https://www.strava.com/settings/api"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-[#fc5200] hover:underline"
          >
            Open Strava&apos;s API page <ExternalLink className="size-3.5" />
          </a>{" "}
          (log in with your Strava account) and fill in the form with these values:
          <div className="mt-2 flex flex-col gap-1.5">
            <CopyField label="Application Name" value="PolyRunner" />
            <CopyField label="Category" value="Other" />
            <CopyField label="Website" value={origin} />
            <CopyField label="Description" value="Race-time prediction game among friends" />
            <CopyField label="Callback Domain" value={domain} />
          </div>
        </li>
        <li>Accept the terms, create the app and upload any image as its icon.</li>
        <li>
          On the app page, copy the <b>Client ID</b> and the <b>Client Secret</b> (click &ldquo;show&rdquo;)
          and paste them here:
          <div className="mt-2">
            <CredentialsForm />
          </div>
        </li>
        <li className="text-muted-foreground">
          New Strava apps can only connect their owner. To let friends join, click &ldquo;Request
          more athletes&rdquo; (athlete capacity) on the same Strava page.
        </li>
      </ol>
    </div>
  );
}

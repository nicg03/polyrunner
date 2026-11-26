import Link from "next/link";
import { Footprints, Timer, Users, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata = {
  title: {
    absolute: "PolyRunner — Pronostica i tempi dei tuoi amici",
  },
  description:
    "PolyRunner è un gioco sociale per runner: pronostica i tempi di gara degli amici con crediti virtuali. Nessun denaro reale nei mercati.",
};

export default async function LandingPage() {
  const profile = await getCurrentProfile();

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2">
      {/* Hero */}
      <section className="landing-hero relative isolate overflow-hidden border-b border-border/60">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_20%,rgba(45,108,245,0.28),transparent_55%),radial-gradient(ellipse_50%_40%_at_10%_80%,rgba(39,174,96,0.12),transparent_50%)]"
        />
        <div
          aria-hidden
          className="landing-grid pointer-events-none absolute inset-0 opacity-[0.35]"
        />
        <div
          aria-hidden
          className="landing-lane pointer-events-none absolute inset-y-0 right-[-8%] hidden w-[55%] md:block"
        />

        <div className="relative mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-7xl flex-col justify-center px-4 py-16 sm:py-20">
          <div className="landing-fade max-w-2xl">
            <p className="mb-5 flex items-center gap-2 text-sm font-medium tracking-wide text-primary">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Footprints className="size-4" />
              </span>
              PolyRunner
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-[1.1]">
              Pronostica i tempi di gara dei tuoi amici
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              Un gioco sociale per runner: scommetti crediti virtuali sul tempo esatto di una
              gara, confrontati con gli amici e festeggia il risultato. Solo per divertimento —
              i crediti non valgono denaro.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {profile ? (
                <Link href="/markets" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}>
                  Vai ai mercati
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
                  >
                    Inizia gratis
                  </Link>
                  <Link
                    href="/markets"
                    className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 px-5")}
                  >
                    Esplora i mercati
                  </Link>
                </>
              )}
            </div>
          </div>

          <div
            aria-hidden
            className="landing-fade-delay pointer-events-none absolute bottom-10 right-4 hidden w-[min(420px,42vw)] lg:block"
          >
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* Come funziona */}
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:py-24">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Come funziona</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Tre passaggi. Niente complicazioni.
          </p>

          <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative">
                <span className="text-xs font-medium uppercase tracking-wider text-primary">
                  Passo {i + 1}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Cosa puoi fare */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:py-24">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Cosa puoi fare</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Il cuore del prodotto è il pronostico tra amici. Il resto serve a renderlo più vivo.
          </p>

          <ul className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <f.icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Chiarimento crediti */}
      <section className="border-b border-border/60 bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight">Solo crediti virtuali</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Ogni account parte con crediti di gioco. Non sono trasferibili tra utenti e non
              sono convertibili in denaro. Puoi etichettarli anche come «birre» per chiudere il
              conto tra amici nella vita reale — ma i mercati restano un gioco.
            </p>
          </div>
        </div>
      </section>

      {/* CTA finale */}
      <section>
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-20 sm:py-24">
          <h2 className="max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">
            Pronto a indovinare chi arriva sotto le due ore?
          </h2>
          <p className="max-w-md text-muted-foreground">
            Entra, collega gli amici runner e crea la prima scommessa sulla prossima gara.
          </p>
          <div className="flex flex-wrap gap-3">
            {profile ? (
              <Link href="/markets" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}>
                Apri i mercati
              </Link>
            ) : (
              <>
                <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}>
                  Crea un account
                </Link>
                <Link
                  href="/markets"
                  className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 px-5")}
                >
                  Guarda un mercato
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

const STEPS = [
  {
    title: "Aggiungi i tuoi amici",
    body: "Cerca runner per nome o username e accettatevi a vicenda. Solo chi è nella tua cerchia può diventare oggetto di un mercato tra amici.",
  },
  {
    title: "Crea o entra in un mercato",
    body: "Scegli una gara e un atleta. Pronostica il tempo di arrivo esatto, oppure rispondi a una domanda Sì/No legata alla corsa.",
  },
  {
    title: "Vedi chi ci azzecca",
    body: "Dopo la gara il risultato viene verificato. Chi si è avvicinato di più al tempo reale guadagna più crediti. Poi si riparte.",
  },
];

const FEATURES = [
  {
    icon: Timer,
    title: "Tempi di arrivo",
    body: "Indovina il finish time: più sei preciso, più guadagni. Niente quote confuse — conta l’errore assoluto.",
  },
  {
    icon: Users,
    title: "Cerchia di amici",
    body: "Leaderboard e scommesse restano tra chi si conosce. Puoi anche seguire mercati su atleti Pro selezionati.",
  },
  {
    icon: Wallet,
    title: "Wallet e progressi",
    body: "Segui saldo, posizioni aperte e storico. Correndo e collegando Strava guadagni crediti; con Premium sblocchi vantaggi extra.",
  },
];

function HeroPreview() {
  return (
    <div className="landing-preview rounded-2xl border border-border/80 bg-card/80 p-5 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.7)] backdrop-blur-sm">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Milano Marathon · 42K</span>
        <span className="rounded-md bg-yes/15 px-2 py-0.5 font-medium text-yes">Aperto</span>
      </div>
      <p className="mt-3 text-sm font-medium">Quanto farà Sara?</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">3:18:40</p>
      <p className="mt-1 text-xs text-muted-foreground">Consenso degli amici</p>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="landing-bar h-full w-[68%] rounded-full bg-primary" />
      </div>
      <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
        <span>12 pronostici</span>
        <span>±4:20 di spread</span>
      </div>
    </div>
  );
}

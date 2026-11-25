"use client";

import { useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/time";

export function ResultShareCard({
  runnerName,
  raceName,
  actualSeconds,
  marketConsensusSeconds,
  marketConsensusLabel,
}: {
  runnerName: string;
  raceName: string;
  actualSeconds: number;
  marketConsensusSeconds: number | null;
  marketConsensusLabel?: string | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const consensusText =
    marketConsensusSeconds != null
      ? formatTime(marketConsensusSeconds)
      : marketConsensusLabel ?? "—";
  const beat =
    marketConsensusSeconds != null ? actualSeconds < marketConsensusSeconds : null;

  async function toPng(): Promise<Blob | null> {
    const el = cardRef.current;
    if (!el) return null;
    const canvas = document.createElement("canvas");
    const w = 1080;
    const h = 1920;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#14532d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "48px system-ui, sans-serif";
    ctx.fillText("PolyRunner", 80, 160);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 64px system-ui, sans-serif";
    wrapText(ctx, raceName, 80, 280, w - 160, 72);

    ctx.fillStyle = "#86efac";
    ctx.font = "bold 56px system-ui, sans-serif";
    ctx.fillText(runnerName, 80, 480);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "40px system-ui, sans-serif";
    ctx.fillText("Il mercato diceva", 80, 700);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 120px system-ui, sans-serif";
    ctx.fillText(consensusText, 80, 860);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "40px system-ui, sans-serif";
    ctx.fillText("Io:", 80, 1100);
    ctx.fillStyle = beat === true ? "#4ade80" : beat === false ? "#f87171" : "#f8fafc";
    ctx.font = "bold 140px system-ui, sans-serif";
    ctx.fillText(formatTime(actualSeconds), 80, 1280);

    if (beat === true) {
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 48px system-ui, sans-serif";
      ctx.fillText("Ho battuto il mercato ✨", 80, 1480);
    }

    ctx.fillStyle = "#64748b";
    ctx.font = "36px system-ui, sans-serif";
    ctx.fillText("polyrunner.app", 80, 1800);

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  }

  async function download() {
    setBusy(true);
    try {
      const blob = await toPng();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `polyrunner-${runnerName.replace(/\s+/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    try {
      const blob = await toPng();
      if (!blob) return;
      const file = new File([blob], "polyrunner-risultato.png", { type: "image/png" });
      const text = `Il mercato diceva ${consensusText}. Io: ${formatTime(actualSeconds)} — ${raceName}`;
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: "PolyRunner" });
      } else if (navigator.share) {
        await navigator.share({ text, title: "PolyRunner" });
      } else {
        await download();
      }
    } catch {
      /* user cancelled */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div
        ref={cardRef}
        className="mx-auto aspect-[9/16] w-full max-w-[220px] rounded-lg bg-gradient-to-b from-slate-900 to-emerald-950 p-4 text-slate-100"
      >
        <p className="text-[10px] text-slate-400">PolyRunner</p>
        <p className="mt-2 line-clamp-2 text-xs font-medium">{raceName}</p>
        <p className="mt-3 text-sm font-semibold text-emerald-300">{runnerName}</p>
        <p className="mt-6 text-[10px] text-slate-400">Il mercato diceva</p>
        <p className="text-2xl font-bold">{consensusText}</p>
        <p className="mt-4 text-[10px] text-slate-400">Io</p>
        <p
          className={`text-3xl font-bold ${beat === true ? "text-emerald-400" : beat === false ? "text-red-400" : ""}`}
        >
          {formatTime(actualSeconds)}
        </p>
        {beat === true && (
          <p className="mt-3 text-[10px] font-semibold text-emerald-400">Ho battuto il mercato</p>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={share} className="flex-1">
          <Share2 className="size-4" /> Condividi
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={download} className="flex-1">
          <Download className="size-4" /> Scarica
        </Button>
      </div>
    </div>
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

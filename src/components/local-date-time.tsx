"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

// datetime-local is in the browser's time zone: convert to ISO before sending it to the server.
export function LocalDateTime({ name, required }: { name: string; required?: boolean }) {
  const [local, setLocal] = useState("");
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <>
      <Input
        type="datetime-local"
        required={required}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
      />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}

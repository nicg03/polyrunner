"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/types";

// Form bound to a server action: shows a toast with the result and resets on success.
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = true,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode | ((pending: boolean) => React.ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.error) toast.error(state.error);
    if (state.ok) {
      toast.success(state.ok);
      if (resetOnSuccess) formRef.current?.reset();
    }
  }, [state, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {typeof children === "function" ? children(pending) : children}
    </form>
  );
}

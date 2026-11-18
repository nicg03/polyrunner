"use client";

import { useTransition } from "react";
import { Check, Link2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { addFriend, removeFriend } from "@/actions/friends";
import { Button } from "@/components/ui/button";

export function FriendButton({ athleteId, following }: { athleteId: string; following: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={following ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await (following ? removeFriend(athleteId) : addFriend(athleteId));
          if (res?.error) toast.error(res.error);
          else if (res?.ok) toast.success(res.ok);
        })
      }
    >
      {following ? (
        <>
          <Check /> Friends
        </>
      ) : (
        <>
          <UserPlus /> Add
        </>
      )}
    </Button>
  );
}

export function CopyInviteLink({ path }: { path: string }) {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}${path}`);
        toast.success("Link copied: send it to your friends");
      }}
    >
      <Link2 /> Copy my link
    </Button>
  );
}

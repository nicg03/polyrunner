"use client";

import { useTransition } from "react";
import { Check, Clock, Link2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  acceptFriend,
  cancelFriendRequest,
  declineFriend,
  removeFriend,
  requestFriend,
} from "@/actions/friends";
import { Button } from "@/components/ui/button";
import type { FriendshipStatus } from "@/lib/queries";

export function FriendButton({
  athleteId,
  status,
}: {
  athleteId: string;
  status: FriendshipStatus;
}) {
  const [pending, startTransition] = useTransition();

  if (status === "friends") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await removeFriend(athleteId);
            if (res?.error) toast.error(res.error);
            else if (res?.ok) toast.success(res.ok);
          })
        }
      >
        <Check /> Friends
      </Button>
    );
  }

  if (status === "pending_out") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await cancelFriendRequest(athleteId);
            if (res?.error) toast.error(res.error);
            else if (res?.ok) toast.success(res.ok);
          })
        }
      >
        <Clock /> Requested
      </Button>
    );
  }

  if (status === "pending_in") {
    return (
      <span className="text-xs text-muted-foreground">Respond in requests below</span>
    );
  }

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await requestFriend(athleteId);
          if (res?.error) toast.error(res.error);
          else if (res?.ok) toast.success(res.ok);
        })
      }
    >
      <UserPlus /> Add
    </Button>
  );
}

export function IncomingRequestButtons({ fromUserId }: { fromUserId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await acceptFriend(fromUserId);
            if (res?.error) toast.error(res.error);
            else if (res?.ok) toast.success(res.ok);
          })
        }
      >
        <Check /> Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await declineFriend(fromUserId);
            if (res?.error) toast.error(res.error);
            else if (res?.ok) toast.success(res.ok);
          })
        }
      >
        <X /> Decline
      </Button>
    </div>
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

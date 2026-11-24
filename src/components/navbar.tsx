import Link from "next/link";
import { Footprints, Plus, Trophy, User, UserPlus, Wallet, Shield } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentProfile } from "@/lib/auth";
import { logout } from "@/actions/auth";
import { formatCredits, formatEur } from "@/lib/format";
import { Avatar } from "@/components/avatar";

export async function Navbar() {
  const profile = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Footprints className="size-5" />
          </span>
          <span className="hidden text-lg sm:inline">PolyRunner</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm sm:ml-4">
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
            Markets
          </Link>
          {profile && (
            <Link href="/friends" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <UserPlus /> <span className="hidden sm:inline">Friends</span>
            </Link>
          )}
          <Link href="/leaderboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <Trophy /> <span className="hidden sm:inline">Leaderboard</span>
          </Link>
          {profile?.is_admin && (
            <Link href="/admin" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <Shield /> <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {profile ? (
            <>
              <Link href="/create" className={buttonVariants({ size: "sm" })}>
                <Plus /> <span className="hidden sm:inline">Create bet</span>
              </Link>
              <Link href="/wallet" className="flex flex-col items-end leading-tight hover:opacity-80">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  Credits
                  {profile.is_premium && (
                    <span className="rounded bg-amber-400/20 px-1 text-[10px] font-semibold text-amber-500">
                      PREMIUM
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold text-yes">
                  {formatCredits(profile.balance)}
                </span>
                {Number(profile.eur_balance) > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    EUR {formatEur(Number(profile.eur_balance))}
                  </span>
                )}
              </Link>
              <Link href="/wallet" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Wallet /> <span className="hidden sm:inline">Wallet</span>
              </Link>
              <Link href="/profile" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <User /> <span className="hidden sm:inline">Profile</span>
              </Link>
              <Link href="/profile">
                <Avatar name={profile.username} url={profile.avatar_url} />
              </Link>
              <form action={logout}>
                <button className="text-xs text-muted-foreground hover:text-foreground">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

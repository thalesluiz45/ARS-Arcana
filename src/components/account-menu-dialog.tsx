"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  ChevronRight,
  Loader2,
  LogOut,
  Swords,
  UserRound,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loginHref } from "@/lib/auth/redirect";
import { cn } from "@/lib/utils";

export type AccountMenuUser = {
  name: string | null;
  email: string | null;
};

const accountButtonClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-sm border border-gold/55 bg-white/[0.035] text-[#f2ecdd] transition-colors hover:border-gold hover:bg-white/[0.08] focus-visible:outline-offset-4";

function AccountLink({
  href,
  icon: Icon,
  label,
  description,
  onNavigate,
}: {
  href: string;
  icon: typeof Bookmark;
  label: string;
  description: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group flex items-center gap-3 rounded-md border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-secondary/60 focus-visible:outline-offset-1"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-sm border border-gold/30 bg-parchment text-forest">
        <Icon className="size-4" strokeWidth={1.6} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-forest">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

export function AccountMenuDialog({
  user,
  className,
}: {
  user: AccountMenuUser | null;
  className?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <Link
        href={loginHref(pathname)}
        aria-label="Entrar na sua conta"
        className={cn(accountButtonClass, className)}
      >
        <UserRound className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </Link>
    );
  }

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await signOut({ redirectTo: "/" });
    } catch {
      setError("Não foi possível encerrar sua sessão. Tente novamente.");
      setSigningOut(false);
    }
  }

  const displayName = user.name?.trim() || "Aventureiro";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label="Abrir menu da sua conta"
        aria-haspopup="dialog"
        className={cn(accountButtonClass, className)}
      >
        <UserRound className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden sm:max-w-md">
          <DialogHeader className="min-w-0">
            <div className="flex min-w-0 items-center gap-3 pr-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-full border border-gold/40 bg-parchment text-forest">
                <UserRound
                  className="size-5"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <DialogTitle className="text-xl text-forest">
                  Sua conta
                </DialogTitle>
                <DialogDescription className="mt-1 flex min-w-0 flex-col text-left">
                  {displayName ? (
                    <span className="truncate">{displayName}</span>
                  ) : null}
                  {user.email ? (
                    <span className="truncate text-xs" title={user.email}>
                      {user.email}
                    </span>
                  ) : null}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <nav
            aria-label="Áreas da sua conta"
            className="mt-1 min-w-0 space-y-1"
          >
            <AccountLink
              href="/magias-salvas"
              icon={Bookmark}
              label="Magias Salvas"
              description="Seus grimórios e magias guardadas."
              onNavigate={() => setOpen(false)}
            />
            <AccountLink
              href="/arsenal"
              icon={Swords}
              label="Arsenal"
              description="Suas mochilas e equipamentos salvos."
              onNavigate={() => setOpen(false)}
            />
          </nav>

          {error ? (
            <p role="alert" className="break-words text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="destructive"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="h-10 w-full sm:w-auto"
            >
              {signingOut ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="size-4" aria-hidden="true" />
              )}
              Sair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

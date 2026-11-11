"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Bookmark, Menu } from "lucide-react";
import { useState } from "react";

import { SavedCount } from "@/components/saved-count";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Biblioteca de magias",
    match: (path: string) => path === "/",
  },
  {
    href: "/magias-salvas",
    label: "Meus grimórios",
    match: (path: string) => path.startsWith("/magias-salvas"),
  },
  {
    href: "/guia",
    label: "Guia do aventureiro",
    match: (path: string) => path.startsWith("/guia"),
  },
] as const;

function Brand() {
  return (
    <Link
      href="/"
      className="group flex items-center gap-3 rounded-sm text-[#f4ecdc] focus-visible:outline-offset-8"
      aria-label="ARS Arcana — ir para a Biblioteca de magias"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-sm border border-gold/50 bg-white/[0.04] text-gold transition-colors group-hover:bg-white/[0.08]">
        <BookOpen className="size-6" strokeWidth={1.3} aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-heading text-[1.55rem] tracking-[0.14em] text-[#f7f0e0]">
          ARS ARCANA
        </span>
        <span className="mt-1 text-[0.55rem] font-semibold uppercase tracking-[0.42em] text-gold/85">
          Spellbook
        </span>
      </span>
    </Link>
  );
}

function DesktopNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Navegação principal" className="hidden lg:block">
      <ul className="flex items-center gap-8 xl:gap-11">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2 py-6 text-[0.92rem] tracking-[0.015em] transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors ${
                  active
                    ? "text-gold after:bg-gold"
                    : "text-[#d8d4c7] after:bg-transparent hover:text-white"
                }`}
              >
                {item.label}
                {item.href === "/guia" ? (
                  <span className="rounded-full border border-gold/30 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.16em] text-gold/80">
                    Em breve
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SavedShortcut({ mobile = false }: { mobile?: boolean }) {
  return (
    <Link
      href="/magias-salvas"
      className={`inline-flex items-center gap-2.5 rounded-sm border border-gold/55 bg-white/[0.035] px-4 py-2.5 text-sm text-[#f2ecdd] transition-colors hover:border-gold hover:bg-white/[0.08] ${
        mobile ? "w-full justify-start" : ""
      }`}
    >
      <Bookmark
        className="size-4 text-gold"
        strokeWidth={1.7}
        aria-hidden="true"
      />
      <span>Magias salvas</span>
      <SavedCount className="ml-auto grid min-w-6 place-items-center rounded-sm bg-gold/15 px-1.5 py-0.5 text-xs font-semibold text-gold" />
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-forest text-[#f4ecdc]">
      <div className="container-page flex min-h-[92px] items-center justify-between gap-6">
        <Brand />
        <DesktopNav pathname={pathname} />
        <div className="hidden lg:block">
          <SavedShortcut />
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="border-white/20 bg-white/5 text-[#f4ecdc] hover:bg-white/10 hover:text-white"
                  aria-label="Abrir menu de navegação"
                />
              }
            >
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="border-l border-gold/25 bg-forest text-[#f4ecdc] sm:max-w-sm"
            >
              <SheetHeader>
                <SheetTitle className="font-heading text-2xl text-[#f7f0e0]">
                  ARS ARCANA
                </SheetTitle>
                <SheetDescription className="text-[#cfc9ba]">
                  Navegue pela biblioteca e pelos seus grimórios.
                </SheetDescription>
              </SheetHeader>
              <nav aria-label="Navegação principal" className="mt-4 px-4">
                <ul className="flex flex-col gap-1">
                  {NAV_ITEMS.map((item) => {
                    const active = item.match(pathname);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center justify-between rounded-sm px-3 py-3 text-sm transition-colors ${
                            active
                              ? "bg-white/10 text-gold"
                              : "text-[#e2ddcf] hover:bg-white/5"
                          }`}
                        >
                          {item.label}
                          {item.href === "/guia" ? (
                            <span className="rounded-full border border-gold/30 px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.14em] text-gold/80">
                              Em breve
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="mt-6 px-4">
                <SavedShortcut mobile />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <div className="border-t border-white/10" />
    </header>
  );
}

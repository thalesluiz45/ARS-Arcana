"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SITE_NAV_ITEMS } from "@/lib/site-navigation";

function SoonBadge() {
  return (
    <span className="rounded-full border border-gold/30 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.16em] text-gold/80">
      Em breve
    </span>
  );
}

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="hidden lg:block">
      <ul className="flex items-center gap-8 xl:gap-11">
        {SITE_NAV_ITEMS.map((item) => {
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
                {item.soon ? <SoonBadge /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="size-11 border-white/20 bg-white/5 text-[#f4ecdc] hover:bg-white/10 hover:text-white"
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
              Navegue pela biblioteca e pelo seu acervo arcano.
            </SheetDescription>
          </SheetHeader>
          <nav aria-label="Navegação principal" className="mt-4 px-4">
            <ul className="flex flex-col gap-1">
              {SITE_NAV_ITEMS.map((item) => {
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
                      {item.soon ? <SoonBadge /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}

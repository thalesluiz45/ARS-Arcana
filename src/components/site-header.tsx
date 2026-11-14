import Link from "next/link";
import { BookOpen } from "lucide-react";

import { AccountMenu } from "@/components/account-menu";
import { DesktopNav, MobileNav } from "@/components/site-nav";

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

export function SiteHeader() {
  return (
    <header className="bg-forest text-[#f4ecdc]">
      <div className="container-page flex min-h-[92px] items-center justify-between gap-4 sm:gap-6">
        <Brand />
        <DesktopNav />
        <div className="flex items-center gap-2">
          <AccountMenu />
          <MobileNav />
        </div>
      </div>
      <div className="border-t border-white/10" />
    </header>
  );
}

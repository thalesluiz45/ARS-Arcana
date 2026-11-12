import { GrimoireDataProvider } from "@/components/grimoire-data-provider";
import { LegacyDataCleanup } from "@/components/legacy-data-cleanup";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth/session";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <GrimoireDataProvider>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
      {user ? <LegacyDataCleanup /> : null}
    </GrimoireDataProvider>
  );
}

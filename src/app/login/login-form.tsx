"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

import { ArcaneCircle } from "@/components/arcane-circle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  clearLegacyCleanupPending,
  inspectLegacyListData,
  markLegacyCleanupPending,
  type LegacyListDataSummary,
} from "@/lib/local/legacy";

import { LoginBackdrop } from "./login-backdrop";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "O acesso com Google foi cancelado ou negado. Tente novamente quando quiser.",
  OAuthAccountNotLinked:
    "Já existe uma conta com este e-mail, mas ela não pôde ser vinculada ao Google. Tente novamente ou use a conta original.",
  Configuration: "O login com Google ainda não está configurado neste ambiente.",
  OAuthCallback: "O Google retornou uma resposta inválida. Tente novamente.",
  OAuthCallbackError: "O Google retornou uma resposta inválida. Tente novamente.",
  Verification: "A verificação de acesso expirou. Tente novamente.",
};

function describeAuthError(code: string | null): string | null {
  if (!code) return null;
  return (
    AUTH_ERROR_MESSAGES[code] ??
    "Não foi possível entrar com Google. Verifique sua conexão e tente novamente."
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.35 12.2c0-.7-.06-1.37-.18-2.02H12v3.83h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.2Z"
      />
      <path
        fill="#34A853"
        d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.75 9.75 0 0 0 12 21.5Z"
      />
      <path
        fill="#FBBC05"
        d="M6.53 13.58a5.86 5.86 0 0 1 0-3.16V7.89H3.29a9.76 9.76 0 0 0 0 8.22l3.24-2.53Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.39c1.43 0 2.72.49 3.73 1.45l2.8-2.8A9.38 9.38 0 0 0 12 2.5a9.75 9.75 0 0 0-8.71 5.39l3.24 2.53C7.3 8.11 9.46 6.39 12 6.39Z"
      />
    </svg>
  );
}

function Ornament({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#cdbb92] to-[#cdbb92]" />
        <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-gold" fill="currentColor">
          <path d="M12 0 14 10 24 12 14 14 12 24 10 14 0 12 10 10Z" />
        </svg>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#cdbb92] to-[#cdbb92]" />
      </div>
    </div>
  );
}

function legacySummaryText(summary: LegacyListDataSummary): string {
  const parts: string[] = [];
  if (summary.namedGrimoires > 0) {
    parts.push(
      `${summary.namedGrimoires} ${summary.namedGrimoires === 1 ? "grimório" : "grimórios"}`,
    );
  }
  if (summary.savedSpells > 0) {
    parts.push(
      `${summary.savedSpells} ${summary.savedSpells === 1 ? "magia salva" : "magias salvas"}`,
    );
  }
  return parts.join(" e ");
}

export function LoginForm({
  returnTo,
  initialError,
}: {
  returnTo: string;
  initialError: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(() => describeAuthError(initialError));
  const [legacy, setLegacy] = useState<LegacyListDataSummary | null>(null);
  const [legacyChecked, setLegacyChecked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (initialError) clearLegacyCleanupPending();
  }, [initialError]);

  useEffect(() => {
    let cancelled = false;

    inspectLegacyListData()
      .then((summary) => {
        if (!cancelled) setLegacy(summary);
      })
      .catch(() => {
        // Detection is best-effort: a failure must not block a legitimate
        // login. Without confirmation nothing is deleted.
        if (!cancelled) setLegacy(null);
      })
      .finally(() => {
        if (!cancelled) setLegacyChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function startSignIn() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await signIn("google", { redirectTo: returnTo });
    } catch {
      setError(
        "Não foi possível iniciar o login com Google. Verifique sua conexão e tente novamente.",
      );
      setPending(false);
    }
  }

  function requestSignIn() {
    if (pending || !legacyChecked) return;
    if (legacy?.hasData) {
      setConfirmOpen(true);
      return;
    }
    void startSignIn();
  }

  function confirmLegacyCleanup() {
    markLegacyCleanupPending();
    setConfirmOpen(false);
    void startSignIn();
  }

  const disabled = pending || !legacyChecked;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#0a251f] text-[#f5eedf]">
      <LoginBackdrop />

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-[1480px] items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,620px)] lg:gap-16 lg:px-14 lg:py-12 xl:gap-24">
        <section className="flex flex-col items-center text-center">
          <ArcaneCircle className="size-36 text-gold/90 sm:size-44 lg:size-52" />
          <p className="mt-5 font-heading text-[clamp(2.35rem,5.2vw,4.15rem)] leading-none tracking-[0.1em] text-[#f7f0df]">
            ARS ARCANA
          </p>
          <div className="mt-4 flex w-full max-w-[340px] items-center gap-3 text-gold">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/70 to-gold/70" />
            <span className="size-1.5 rotate-45 bg-gold" />
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.48em] text-gold/90">
              Spellbook
            </span>
            <span className="size-1.5 rotate-45 bg-gold" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/70 to-gold/70" />
          </div>
          <p className="mt-8 max-w-sm font-heading text-[clamp(1.7rem,3vw,2.4rem)] leading-[1.15] text-[#f2ead9]">
            A magia está
            <br />
            em suas mãos.
          </p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#c8d2c7]">
            Explore e descubra magias para o seu RPG.
          </p>
        </section>

        <section className="w-full">
          <div className="relative mx-auto w-full max-w-[620px] rounded-2xl border border-[#d9c9a3] bg-[#fbf6ea] px-6 py-9 shadow-[0_32px_90px_-32px_rgb(0_0_0/0.72)] sm:px-12 sm:py-12">
            <Ornament className="mx-auto w-full max-w-[430px]" />

            <h1 className="mt-7 text-center text-[clamp(2.15rem,4.4vw,3.05rem)] leading-none text-[#143d33]">
              Bem-vindo de volta!
            </h1>
            <p className="mt-4 text-center text-sm text-[#5b655e] sm:text-base">
              Faça login para continuar sua jornada.
            </p>

            <button
              type="button"
              onClick={requestSignIn}
              disabled={disabled}
              className="mt-8 flex min-h-[76px] w-full items-center justify-center rounded-lg border border-[#cdbfa2] bg-white/75 px-5 text-[#22302a] shadow-[0_1px_0_rgb(255_255_255/0.8)_inset,0_10px_24px_-18px_rgb(34_48_42/0.55)] transition-colors hover:border-gold/80 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <span className="flex items-center gap-3">
                  <Loader2 className="size-5 animate-spin text-forest" aria-hidden="true" />
                  <span className="font-heading text-[1.3rem] tracking-[0.01em] text-forest sm:text-[1.45rem]">
                    Conectando ao Google…
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-4">
                  <GoogleMark />
                  <span className="h-9 w-px bg-[#d8ccb5]" aria-hidden="true" />
                  <span className="font-heading text-[1.3rem] tracking-[0.01em] text-forest sm:text-[1.45rem]">
                    Entrar com Google
                  </span>
                </span>
              )}
            </button>

            {error ? (
              <div
                role="alert"
                className="mt-5 rounded-md border border-[#b3453a]/30 bg-[#fdf1ed] px-4 py-3 text-sm text-[#7a2c25]"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="leading-relaxed">{error}</p>
                    <button
                      type="button"
                      onClick={requestSignIn}
                      disabled={disabled}
                      className="mt-2 font-semibold underline-offset-4 hover:underline disabled:opacity-60"
                    >
                      Tentar novamente
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <Ornament className="mt-8" />

            <p className="mt-7 text-center text-sm text-[#5b655e]">
              Ainda não tem uma conta?{" "}
              <button
                type="button"
                onClick={requestSignIn}
                disabled={disabled}
                className="font-semibold text-[#143d33] underline-offset-4 hover:underline disabled:opacity-60"
              >
                Crie uma agora
              </button>
            </p>
          </div>

          <p className="mt-5 text-center text-xs text-[#cfd8cd]">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Voltar para a biblioteca
            </Link>
          </p>
        </section>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-[#f4ecdc] text-forest">
              <ShieldAlert className="size-5" aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-xl">Dados antigos neste navegador</AlertDialogTitle>
            <AlertDialogDescription>
              Encontramos {legacy ? legacySummaryText(legacy) : "dados antigos"} salvos por uma
              versão anterior. Eles não serão importados para a sua conta e serão apagados deste
              navegador depois que o login com Google for concluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Se cancelar, os dados locais permanecem como estão e não são associados à sua conta.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLegacyCleanup}
              disabled={pending}
              className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
            >
              Entrar e apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

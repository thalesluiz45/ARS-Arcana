import { FaGithub } from "react-icons/fa6";
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-parchment/80">
      <div className="container-page flex flex-col items-start justify-between gap-4 py-7 sm:flex-row sm:items-center">
        <p className="font-heading text-lg uppercase tracking-[0.28em] text-forest">
          Grimório
        </p>
        <div className="flex items-center gap-3 text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          <span>Feito para quem vive a aventura</span>
          <a href="https://github.com/thalesluiz45/ARS-Arcana" target="_blank">
            <span className="grid size-8 place-items-center rounded-full border border-border bg-card text-forest">
              <FaGithub
                className="size-3.5"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}

import { AccountMenuDialog } from "@/components/account-menu-dialog";

export default function PreviewAccountMenuPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24">
      <AccountMenuDialog
        user={{
          name: "Aventureiro de Nome Bastante Longo",
          email: "thales.algumacoisa.muito.longa.mesmo@gmail.com",
        }}
      />
    </div>
  );
}

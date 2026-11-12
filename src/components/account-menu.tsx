import { AccountMenuDialog } from "@/components/account-menu-dialog";
import { getSessionUser } from "@/lib/auth/session";

export async function AccountMenu({ className }: { className?: string }) {
  const user = await getSessionUser();
  return (
    <AccountMenuDialog
      className={className}
      user={user ? { name: user.name, email: user.email } : null}
    />
  );
}

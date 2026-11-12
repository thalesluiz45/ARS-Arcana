export type SiteNavItem = {
  href: string;
  label: string;
  soon?: boolean;
  match: (pathname: string) => boolean;
};

export const SITE_NAV_ITEMS: SiteNavItem[] = [
  {
    href: "/",
    label: "Biblioteca de magias",
    match: (pathname) => pathname === "/",
  },
  {
    href: "/equipamento",
    label: "Equipamento",
    soon: true,
    match: (pathname) => pathname.startsWith("/equipamento"),
  },
  {
    href: "/guia",
    label: "Guia do aventureiro",
    soon: true,
    match: (pathname) => pathname.startsWith("/guia"),
  },
];

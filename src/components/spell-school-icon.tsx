import {
  BookOpen,
  CircleDot,
  Eye,
  Flame,
  FlaskConical,
  Ghost,
  Heart,
  Shield,
  Skull,
  type LucideIcon,
} from "lucide-react";

export type SchoolStyle = {
  icon: LucideIcon;
  iconClassName: string;
  tileClassName: string;
};

const SCHOOL_STYLES: Record<string, SchoolStyle> = {
  Abjuração: {
    icon: Shield,
    iconClassName: "text-[#9a6538]",
    tileClassName: "bg-[#f4e6d8]",
  },
  Adivinhação: {
    icon: Eye,
    iconClassName: "text-[#65538d]",
    tileClassName: "bg-[#e9e3f5]",
  },
  Encantamento: {
    icon: Heart,
    iconClassName: "text-[#9d5470]",
    tileClassName: "bg-[#f6e4ea]",
  },
  Evocação: {
    icon: Flame,
    iconClassName: "text-[#b25733]",
    tileClassName: "bg-[#f8e2d5]",
  },
  Ilusão: {
    icon: Ghost,
    iconClassName: "text-[#6a559b]",
    tileClassName: "bg-[#e9e2f6]",
  },
  Invocação: {
    icon: CircleDot,
    iconClassName: "text-[#3d735d]",
    tileClassName: "bg-[#dfece5]",
  },
  Necromancia: {
    icon: Skull,
    iconClassName: "text-[#57665c]",
    tileClassName: "bg-[#e7e9e5]",
  },
  Transmutação: {
    icon: FlaskConical,
    iconClassName: "text-[#467186]",
    tileClassName: "bg-[#e3edf2]",
  },
};

const FALLBACK: SchoolStyle = {
  icon: BookOpen,
  iconClassName: "text-primary",
  tileClassName: "bg-secondary",
};

export function schoolStyle(school: string): SchoolStyle {
  return SCHOOL_STYLES[school] ?? FALLBACK;
}

export function SpellSchoolIcon({
  school,
  size = "md",
  className,
}: {
  school: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const style = schoolStyle(school);
  const Icon = style.icon;
  const dimension = size === "lg" ? "size-14" : size === "sm" ? "size-8" : "size-11";
  const iconSize = size === "lg" ? "size-7" : size === "sm" ? "size-4" : "size-5";

  return (
    <span
      aria-hidden="true"
      className={`${style.tileClassName} ${dimension} grid shrink-0 place-items-center rounded-md ${className ?? ""}`}
    >
      <Icon className={`${style.iconClassName} ${iconSize}`} strokeWidth={1.6} />
    </span>
  );
}

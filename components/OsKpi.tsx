import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

export type OsTone = "warn" | "info" | "danger" | "ok" | "neutral";

export function OsKpi({
  href,
  onClick,
  active,
  icon: Icon,
  tone,
  value,
  label,
  hint,
}: {
  href?: string;
  onClick?: () => void;
  active?: boolean;
  icon: LucideIcon;
  tone: OsTone;
  value: string | number;
  label: string;
  hint?: string;
}) {
  const className = `os-kpi${href || onClick ? "" : " is-static"}${active ? " is-on" : ""}`;
  const body = (
    <>
      <span className="os-kpi-icon">
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="os-kpi-body">
        <span className="os-kpi-label">{label}</span>
        <span className="os-kpi-value">{value}</span>
        {hint ? <span className="os-kpi-hint">{hint}</span> : null}
      </span>
    </>
  );
  if (onClick && !href) {
    return (
      <button
        type="button"
        className={className}
        data-tone={tone}
        aria-pressed={active}
        onClick={onClick}
      >
        {body}
      </button>
    );
  }
  if (!href) {
    return (
      <div className={className} data-tone={tone}>
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className={className} data-tone={tone}>
      {body}
      <ArrowRight className="os-kpi-go" size={16} />
    </Link>
  );
}

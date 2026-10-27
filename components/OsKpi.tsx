import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

export type OsTone = "warn" | "info" | "danger" | "ok" | "neutral";

export function OsKpi({
  href,
  icon: Icon,
  tone,
  value,
  label,
  hint,
}: {
  href?: string;
  icon: LucideIcon;
  tone: OsTone;
  value: string | number;
  label: string;
  hint?: string;
}) {
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
  if (!href) {
    return (
      <div className="os-kpi is-static" data-tone={tone}>
        {body}
      </div>
    );
  }
  return (
    <Link href={href} className="os-kpi" data-tone={tone}>
      {body}
      <ArrowRight className="os-kpi-go" size={16} />
    </Link>
  );
}

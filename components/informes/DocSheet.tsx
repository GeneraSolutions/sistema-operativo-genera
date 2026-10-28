"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";

const DOC_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function formatDocDate(iso: string) {
  const raw = iso.trim();
  const dayOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let year: number;
  let month: number;
  let day: number;
  if (dayOnly) {
    year = Number(dayOnly[1]);
    month = Number(dayOnly[2]) - 1;
    day = Number(dayOnly[3]);
  } else {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    const bogota = new Date(parsed.getTime() - 5 * 60 * 60 * 1000);
    year = bogota.getUTCFullYear();
    month = bogota.getUTCMonth();
    day = bogota.getUTCDate();
  }
  const name = DOC_MONTHS[month];
  if (!name || !day || !year) return raw;
  return `${day} de ${name} de ${year}`;
}

export function DocSheet({
  kicker,
  title,
  meta,
  facts,
  children,
  legal,
}: {
  kicker: string;
  title: string;
  meta?: string;
  facts: { label: string; value: string }[];
  children: ReactNode;
  legal: ReactNode;
}) {
  const shown = facts.filter((fact) => fact.value.trim());
  return (
    <article className="gen-doc">
      <div className="gen-doc-band" aria-hidden="true" />
      <header className="gen-doc-head">
        <div>
          <p className="gen-doc-kicker">{kicker}</p>
          <h1>{title}</h1>
          {meta ? <p className="gen-doc-meta">{meta}</p> : null}
        </div>
        <BrandLogo height={46} />
      </header>
      {shown.length ? (
        <dl className="gen-doc-facts">
          {shown.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="gen-doc-body">{children}</div>
      <footer className="gen-doc-foot">{legal}</footer>
    </article>
  );
}

export function DocSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="gen-doc-sec">
      <h2>{title}</h2>
      {hint ? <p className="gen-doc-hint">{hint}</p> : null}
      {children}
    </section>
  );
}

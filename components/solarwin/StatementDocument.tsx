import {
  activeEnvios,
  formatCOP,
  gastosOfEnvio,
  isDevolucion,
  totalsAll,
  totalsByPayer,
  totalsForEnvio,
  type SolarwinGasto,
  type SolarwinStatement,
} from "@/lib/solarwin";

function longDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}

function shortDate(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const cell = { padding: "0.45rem 0.3rem" } as const;

export function StatementDocument({
  statement,
}: {
  statement: SolarwinStatement;
}) {
  const { bundle } = statement;
  const envios = activeEnvios(bundle).sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date)
  );
  const all = totalsAll(bundle);
  const over = all.excedeCOP > 0;
  const single = Boolean(statement.envioId);
  const payers = totalsByPayer(bundle);

  // Anexo: todos los movimientos con foto de comprobante, en orden de envío.
  const receipts: { n: number; g: SolarwinGasto }[] = [];
  const receiptNo = new Map<string, number>();
  for (const envio of envios) {
    for (const g of gastosOfEnvio(bundle, envio.id).sort(
      (a, b) => Date.parse(a.date) - Date.parse(b.date)
    )) {
      if (g.receiptDataUrl) {
        const n = receipts.length + 1;
        receipts.push({ n, g });
        receiptNo.set(g.id, n);
      }
    }
  }

  return (
    <article
      className="gen-doc"
      style={{ maxWidth: "52rem", printColorAdjust: "exact" }}
    >
      <div className="gen-doc-band" />
      <header className="gen-doc-head">
        <div>
          <p className="gen-doc-kicker">Genera Solutions SAS</p>
          <h1>Estado de cuenta · Solar win</h1>
          <p className="gen-doc-meta">
            {single
              ? `Detalle del envío "${envios[0]?.concept || "Solar win"}"${envios[0]?.project ? ` · ${envios[0].project}` : ""}`
              : "Dinero enviado por Solar win y gastos realizados"}
            <br />
            Corte al {longDate(statement.createdAt)}
            {statement.createdByName ? ` · Elaboró ${statement.createdByName}` : ""}
          </p>
        </div>
      </header>

      <dl className="gen-doc-facts">
        <div>
          <dt>Total enviado</dt>
          <dd>{formatCOP(all.enviadoCOP)}</dd>
        </div>
        <div>
          <dt>Total gastado</dt>
          <dd>{formatCOP(all.gastadoCOP)}</dd>
        </div>
        {all.devueltoCOP > 0 ? (
          <div>
            <dt>Devuelto a Solar win</dt>
            <dd style={{ color: "#1d5fa8" }}>{formatCOP(all.devueltoCOP)}</dd>
          </div>
        ) : null}
        <div>
          <dt>{over ? "Excedido (Genera adelantó)" : "Saldo disponible"}</dt>
          <dd style={{ color: over ? "#9b2c2c" : "#1f6b45" }}>
            {over ? `− ${formatCOP(all.excedeCOP)}` : formatCOP(all.disponibleCOP)}
          </dd>
        </div>
        {all.devueltoCOP <= 0 ? (
          <div>
            <dt>Uso de lo enviado</dt>
            <dd>{all.usedPercent}%</dd>
          </div>
        ) : null}
      </dl>

      <div className="gen-doc-body">
        {envios.map((envio) => {
          const t = totalsForEnvio(bundle, envio.id);
          const gastos = gastosOfEnvio(bundle, envio.id).sort(
            (a, b) => Date.parse(a.date) - Date.parse(b.date)
          );
          return (
            <section
              key={envio.id}
              className="gen-doc-sec"
              style={{ breakInside: "avoid-page" }}
            >
              <h2>
                Envío · {shortDate(envio.date)} · {envio.concept || "Solar win"}
                {envio.project ? ` · ${envio.project}` : ""}
                {envio.closedAt ? ` · LIQUIDADO ${shortDate(envio.closedAt.slice(0, 10))}` : ""}
              </h2>
              {envio.notes ? <p className="gen-doc-hint">{envio.notes}</p> : null}
              <table
                style={{
                  width: "100%",
                  marginTop: "0.6rem",
                  borderCollapse: "collapse",
                  fontSize: "0.88rem",
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left", color: "#6d7c74", fontSize: "0.75rem" }}>
                    <th style={{ padding: "0.3rem 0", width: "6.5rem" }}>Fecha</th>
                    <th style={{ padding: "0.3rem 0" }}>Concepto</th>
                    <th style={{ padding: "0.3rem 0", textAlign: "right" }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: "1px solid #eee8dc", background: "#f4faf6" }}>
                    <td style={cell}>{shortDate(envio.date)}</td>
                    <td style={{ ...cell, fontWeight: 600 }}>
                      Dinero enviado por Solar win
                    </td>
                    <td
                      style={{
                        ...cell,
                        textAlign: "right",
                        fontWeight: 600,
                        color: "#1f6b45",
                      }}
                    >
                      + {formatCOP(t.enviadoCOP)}
                    </td>
                  </tr>
                  {gastos.map((g) => {
                    const dev = isDevolucion(g);
                    const no = receiptNo.get(g.id);
                    return (
                      <tr
                        key={g.id}
                        style={{
                          borderTop: "1px solid #eee8dc",
                          verticalAlign: "top",
                          background: dev ? "#f3f8fe" : undefined,
                        }}
                      >
                        <td style={cell}>{shortDate(g.date)}</td>
                        <td style={cell}>
                          {dev ? (
                            <strong style={{ color: "#1d5fa8", marginRight: "0.4rem" }}>
                              DEVOLUCIÓN
                            </strong>
                          ) : null}
                          {g.concept}
                          {no ? (
                            <span style={{ color: "#8a6b2a", marginLeft: "0.4rem", fontSize: "0.75rem" }}>
                              [comprobante {no}]
                            </span>
                          ) : null}
                          {g.paidBy || g.notes ? (
                            <span
                              style={{
                                display: "block",
                                color: "#6d7c74",
                                fontSize: "0.78rem",
                              }}
                            >
                              {g.paidBy ? `Pagó: ${g.paidBy}` : ""}
                              {g.paidBy && g.notes ? " · " : ""}
                              {g.notes}
                            </span>
                          ) : null}
                        </td>
                        <td
                          style={{
                            ...cell,
                            textAlign: "right",
                            color: dev ? "#1d5fa8" : "#9b2c2c",
                            whiteSpace: "nowrap",
                          }}
                        >
                          − {formatCOP(g.amountCOP)}
                        </td>
                      </tr>
                    );
                  })}
                  {!gastos.length ? (
                    <tr style={{ borderTop: "1px solid #eee8dc" }}>
                      <td />
                      <td style={{ ...cell, color: "#6d7c74" }}>
                        Sin gastos registrados
                      </td>
                      <td />
                    </tr>
                  ) : null}
                  <tr style={{ borderTop: "2px solid #12241c", fontWeight: 700 }}>
                    <td />
                    <td style={{ padding: "0.5rem 0.3rem" }}>
                      Gastado {formatCOP(t.gastadoCOP)}
                      {t.devueltoCOP > 0 ? ` · Devuelto ${formatCOP(t.devueltoCOP)}` : ""} ·{" "}
                      {t.excedeCOP > 0 ? "Excedido" : "Disponible"}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem 0.3rem",
                        textAlign: "right",
                        color: t.excedeCOP > 0 ? "#9b2c2c" : "#1f6b45",
                      }}
                    >
                      {t.excedeCOP > 0
                        ? `− ${formatCOP(t.excedeCOP)}`
                        : formatCOP(t.disponibleCOP)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          );
        })}

        {payers.length ? (
          <section className="gen-doc-sec" style={{ breakInside: "avoid" }}>
            <h2>Quién puso la plata</h2>
            <table
              style={{
                width: "100%",
                marginTop: "0.5rem",
                borderCollapse: "collapse",
                fontSize: "0.88rem",
              }}
            >
              <tbody>
                {payers.map((p) => (
                  <tr key={p.name} style={{ borderTop: "1px solid #eee8dc" }}>
                    <td style={cell}>{p.name}</td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>
                      {formatCOP(p.totalCOP)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="gen-doc-sec" style={{ paddingBottom: "1.2rem", breakInside: "avoid" }}>
          <h2>Resultado</h2>
          <p className="gen-doc-prose">
            {over
              ? `Los gastos superan lo enviado en ${formatCOP(all.excedeCOP)}. Este valor fue adelantado por Genera Solutions SAS.`
              : `De ${formatCOP(all.enviadoCOP)} enviados se han gastado ${formatCOP(all.gastadoCOP)}${
                  all.devueltoCOP > 0 ? ` y se han devuelto ${formatCOP(all.devueltoCOP)}` : ""
                }. Saldo a favor de Solar win: ${formatCOP(all.disponibleCOP)}.`}
          </p>
        </section>

        {receipts.length ? (
          <section className="gen-doc-sec" style={{ paddingBottom: "1.4rem" }}>
            <h2>Anexo · Comprobantes</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))",
                gap: "0.9rem",
                marginTop: "0.7rem",
              }}
            >
              {receipts.map(({ n, g }) => (
                <figure
                  key={g.id}
                  style={{ margin: 0, breakInside: "avoid" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.receiptDataUrl}
                    alt={`Comprobante ${n}`}
                    style={{
                      width: "100%",
                      height: "auto",
                      border: "1px solid #e4ddd0",
                      borderRadius: 8,
                    }}
                  />
                  <figcaption style={{ fontSize: "0.74rem", marginTop: "0.25rem", color: "#4d5c55" }}>
                    <strong>{n}.</strong> {shortDate(g.date)} · {g.concept} ·{" "}
                    {formatCOP(g.amountCOP)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}

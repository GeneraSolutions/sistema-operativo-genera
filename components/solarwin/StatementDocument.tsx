import {
  activeEnvios,
  formatCOP,
  gastosOfEnvio,
  totalsAll,
  totalsForEnvio,
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
              ? `Detalle del envío "${envios[0]?.concept || "Solar win"}"`
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
        <div>
          <dt>{over ? "Excedido (Genera adelantó)" : "Saldo disponible"}</dt>
          <dd style={{ color: over ? "#9b2c2c" : "#1f6b45" }}>
            {over ? `− ${formatCOP(all.excedeCOP)}` : formatCOP(all.disponibleCOP)}
          </dd>
        </div>
        <div>
          <dt>Uso de lo enviado</dt>
          <dd>{all.usedPercent}%</dd>
        </div>
      </dl>

      <div className="gen-doc-body">
        {envios.map((envio) => {
          const t = totalsForEnvio(bundle, envio.id);
          const gastos = gastosOfEnvio(bundle, envio.id).sort(
            (a, b) => Date.parse(a.date) - Date.parse(b.date)
          );
          return (
            <section key={envio.id} className="gen-doc-sec" style={{ breakInside: "avoid-page" }}>
              <h2>
                Envío · {shortDate(envio.date)} · {envio.concept || "Solar win"}
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
                    <td style={{ padding: "0.45rem 0.3rem" }}>{shortDate(envio.date)}</td>
                    <td style={{ padding: "0.45rem 0.3rem", fontWeight: 600 }}>
                      Dinero enviado por Solar win
                    </td>
                    <td
                      style={{
                        padding: "0.45rem 0.3rem",
                        textAlign: "right",
                        fontWeight: 600,
                        color: "#1f6b45",
                      }}
                    >
                      + {formatCOP(t.enviadoCOP)}
                    </td>
                  </tr>
                  {gastos.map((g) => (
                    <tr key={g.id} style={{ borderTop: "1px solid #eee8dc", verticalAlign: "top" }}>
                      <td style={{ padding: "0.45rem 0.3rem" }}>{shortDate(g.date)}</td>
                      <td style={{ padding: "0.45rem 0.3rem" }}>
                        {g.concept}
                        {g.notes ? (
                          <span style={{ display: "block", color: "#6d7c74", fontSize: "0.78rem" }}>
                            {g.notes}
                          </span>
                        ) : null}
                      </td>
                      <td
                        style={{
                          padding: "0.45rem 0.3rem",
                          textAlign: "right",
                          color: "#9b2c2c",
                          whiteSpace: "nowrap",
                        }}
                      >
                        − {formatCOP(g.amountCOP)}
                      </td>
                    </tr>
                  ))}
                  {!gastos.length ? (
                    <tr style={{ borderTop: "1px solid #eee8dc" }}>
                      <td />
                      <td style={{ padding: "0.45rem 0.3rem", color: "#6d7c74" }}>
                        Sin gastos registrados
                      </td>
                      <td />
                    </tr>
                  ) : null}
                  <tr style={{ borderTop: "2px solid #12241c", fontWeight: 700 }}>
                    <td />
                    <td style={{ padding: "0.5rem 0.3rem" }}>
                      Gastado {formatCOP(t.gastadoCOP)} ·{" "}
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

        <section className="gen-doc-sec" style={{ paddingBottom: "1.2rem" }}>
          <h2>Resultado</h2>
          <p className="gen-doc-prose">
            {over
              ? `Los gastos superan lo enviado en ${formatCOP(all.excedeCOP)}. Este valor fue adelantado por Genera Solutions SAS.`
              : `De ${formatCOP(all.enviadoCOP)} enviados se han gastado ${formatCOP(all.gastadoCOP)}. Saldo a favor de Solar win: ${formatCOP(all.disponibleCOP)}.`}
          </p>
        </section>
      </div>
    </article>
  );
}

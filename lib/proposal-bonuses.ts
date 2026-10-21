import type {
  ClientDeliverableKey,
  ClientDeliverables,
  EpcProposal,
  ProposalBonus,
  ProposalToggles,
} from "@/types/proposal";

export type BonusDocumentSlug =
  | "explicacion"
  | "manual"
  | "primera-factura"
  | "certificado"
  | "contrato";

/** Valor agregado incluido en cada propuesta comercial Genera. */
export const GENERA_BONUSES: ProposalBonus[] = [
  {
    id: "monitor-24-7",
    title: "Monitoreo inteligente 24/7",
    tagline: "App web · alertas en tiempo real",
    description:
      "Usted ve su planta en el celular: producción del día, historial y avisos si algo baja de lo esperado. No tiene que ser electricista para saber si el sistema está trabajando.",
  },
  {
    id: "proactive-alerts",
    title: "Alertas proactivas Genera Solutions SAS",
    tagline: "Ingeniería revisa · no solo app de fábrica",
    description:
      "Además de la app, ingeniería de Genera Solutions SAS mira anomalías de producción. Si el sistema se queda corto, nosotros llamamos: usted no tiene que descubrirlo en la factura.",
  },
  {
    id: "priority-support",
    title: "Soporte técnico prioritario Genera Solutions SAS",
    tagline: "Respuesta en 48 h hábiles",
    description:
      "Canal directo con ingeniería de Genera Solutions SAS. Una falla, una duda de monitoreo o un ruido raro: responde el equipo que instaló, no un call center genérico.",
  },
  {
    id: "90-days",
    title: "Línea de acompañamiento 90 días",
    tagline: "Post puesta en marcha · canal directo",
    description:
      "Los primeros 90 días después de energizar son de afinación: expectativas de ahorro, lectura de la factura y hábitos de consumo. Ese periodo va incluido.",
  },
  {
    id: "user-manual",
    title: "Manual de Usuario Genera Solutions SAS (PDF)",
    tagline: "Operación · emergencias · contactos · su planta",
    description:
      "Cuando el sistema quede instalado según esta cotización, Genera Solutions SAS le entrega un manual con los equipos reales de su proyecto: cómo se opera, qué hacer en una emergencia, a quién llamar y dónde están las fichas técnicas.",
    document: {
      slug: "manual",
      cta: "Abrir manual de esta planta",
      moment: "handover",
    },
  },
  {
    id: "bill-review",
    title: "Revisión factura vs. producción",
    tagline: "Mes 1 y mes 3 · cruce con comercializador",
    description:
      "En el mes 1 y el mes 3 cruzamos lo que produjo el monitoreo con su factura real. Si el ahorro no cuadra, lo revisamos con números, no con promesas.",
  },
  {
    id: "first-bill-guide",
    title: "Guía: su primera factura con solar",
    tagline: "Autoconsumo · excedentes · por qué se ve rara",
    description:
      "La primera factura con paneles casi siempre confunde. Esta guía le explica, en lenguaje claro, qué es autoconsumo, qué son excedentes y por qué el primer ciclo suele salir distinto. Incluye una sesión breve para resolver dudas.",
    document: {
      slug: "primera-factura",
      cta: "Abrir guía de la primera factura",
      moment: "handover",
    },
  },
  {
    id: "bill-session",
    title: "Sesión «Cómo leer tu factura con solar»",
    tagline: "45 min · presencial o virtual",
    description:
      "Capacitación de 45 minutos para usted o su equipo: autoconsumo, excedentes y por qué la factura sube o baja mes a mes aunque el sol sea el mismo.",
  },
  {
    id: "gen-guarantee",
    title: "Garantía de producción — año 1",
    tagline: "Compromiso de generación",
    description:
      "El primer año hacemos seguimiento a la generación. Si el rendimiento cae bajo lo razonable para su ubicación y el diseño cotizado, ingeniería abre revisión técnica.",
  },
  {
    id: "firmware",
    title: "Actualizaciones de firmware incluidas",
    tagline: "3 años · inversores certificados",
    description:
      "Durante 3 años Genera Solutions SAS gestiona las actualizaciones de firmware de inversores y medición certificada, para no dejar el equipo desactualizado.",
  },
  {
    id: "commissioning-cert",
    title: "Certificado de puesta en marcha",
    tagline: "PDF oficial · kWp · RETIE · fecha de energización",
    description:
      "Acta formal de Genera Solutions SAS con los datos de su planta, fecha de energización y referencia de legalización. Sirve para seguros, bancos, contabilidad y auditorías.",
    document: {
      slug: "certificado",
      cta: "Abrir certificado",
      moment: "handover",
    },
  },
  {
    id: "annual-checklist",
    title: "Checklist anual + revisión remota",
    tagline: "Auto-inspección · 1 videollamada/año",
    description:
      "Una vez al año le enviamos una guía visual (qué mirar en techo, tablero e inversor) y agendamos 15 minutos remotos con ingeniería.",
  },
  {
    id: "warranty-desk",
    title: "Gestor de garantías Genera Solutions SAS — año 1",
    tagline: "Intermediario con fabricante",
    description:
      "Si un panel o un inversor falla en el primer año, Genera Solutions SAS gestiona el trámite con el fabricante. Usted no tiene que pelear el caso en inglés ni con un call center de fábrica.",
  },
  {
    id: "regulatory-bulletin",
    title: "Boletín normativo anual",
    tagline: "CREG · UPME · cambios aplicables",
    description:
      "Una vez al año le resumimos, en una página, qué cambió en CREG/UPME que pueda tocar su sistema y qué conviene hacer.",
  },
  {
    id: "quote-explainer",
    title: "Explicación de cotización (PDF)",
    tagline: "Memoria técnica-comercial · alcance y precio",
    description:
      "Anexo formal de esta cotización: describe el objeto de la oferta, la estructura del precio, el alcance por sistemas, las exclusiones, el procedimiento de ejecución y el significado de cada bono incluido.",
    document: {
      slug: "explicacion",
      cta: "Abrir memoria explicativa",
      moment: "quote",
    },
  },
  {
    id: "commercial-contract",
    title: "Contrato comercial (PDF)",
    tagline: "Cierre · datos de esta cotización",
    description:
      "Minuta lista para que el cliente la lea antes de decidir. Se arma con el nombre, NIT, equipos, precio y forma de pago de esta oferta. Imprimir o guardar como PDF desde el enlace.",
    document: {
      slug: "contrato",
      cta: "Abrir contrato de esta cotización",
      moment: "quote",
    },
  },
];

export function defaultBonusIds(): string[] {
  return GENERA_BONUSES.map((b) => b.id);
}

export function cloneBonus(bonus: ProposalBonus): ProposalBonus {
  return {
    ...bonus,
    document: bonus.document ? { ...bonus.document } : undefined,
  };
}

/** `undefined` = todos (cotizaciones viejas). Array vacío = ninguno. */
export function bonusesFromIds(ids?: string[] | null): ProposalBonus[] {
  if (ids == null) return GENERA_BONUSES.map(cloneBonus);
  const set = new Set(ids);
  return GENERA_BONUSES.filter((b) => set.has(b.id)).map(cloneBonus);
}

export function bonusById(id: string): ProposalBonus | undefined {
  return GENERA_BONUSES.find((b) => b.id === id);
}

export const DEFAULT_CLIENT_DELIVERABLES: ClientDeliverables = {
  fichas: false,
  explicacion: true,
  manual: true,
  "primera-factura": true,
  certificado: true,
  contrato: true,
};

export const CLIENT_DELIVERABLE_LABELS: {
  key: ClientDeliverableKey;
  label: string;
  description: string;
}[] = [
  {
    key: "fichas",
    label: "Fichas técnicas",
    description:
      "Se libera después del anticipo o al cerrar la obra. En la cotización el cliente no las ve.",
  },
  {
    key: "explicacion",
    label: "Memoria explicativa",
    description: "Anexo de alcance y precio para enviar con la oferta",
  },
  {
    key: "manual",
    label: "Manual de usuario",
    description: "Manual de la planta al finalizar la obra",
  },
  {
    key: "primera-factura",
    label: "Guía de la primera factura",
    description: "Autoconsumo, excedentes y lectura de factura",
  },
  {
    key: "certificado",
    label: "Certificado de puesta en marcha",
    description: "Acta oficial con kWp, RETIE y fecha de energización",
  },
  {
    key: "contrato",
    label: "Contrato comercial",
    description: "Documento para enviar al cliente al cerrar, con datos de esta cotización",
  },
];

export function resolveClientDeliverables(
  toggles?: ProposalToggles | null
): ClientDeliverables {
  const fallback = toggles?.showDeliverables !== false;
  const d = toggles?.deliverables ?? {};
  return {
    fichas: d.fichas === true,
    explicacion: d.explicacion ?? fallback,
    manual: d.manual ?? fallback,
    "primera-factura": d["primera-factura"] ?? fallback,
    certificado: d.certificado ?? fallback,
    contrato: d.contrato ?? true,
  };
}

export function datasheetsReleased(toggles?: ProposalToggles | null) {
  return resolveClientDeliverables(toggles).fichas;
}

/** Vista pública: sin URLs de fichas hasta que Genera Solutions las libere. */
export function proposalForClient(proposal: EpcProposal): EpcProposal {
  if (datasheetsReleased(proposal.toggles)) return proposal;
  return { ...proposal, datasheets: [] };
}

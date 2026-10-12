"use client";

import React, { use, useEffect, useState } from "react";

interface VCardData {
  firstName: string;
  lastName: string;
  fullName: string;
  company: string;
  role: string;
  department: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  website: string;
  bookingUrl: string;
  avatarUrl: string;
  logoUrl: string;
  defaultWaMessage: string;
  tags: string[];
  instagramUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  websiteUrl?: string;
}

const PROFILES_DB: Record<string, VCardData> = {
  victor: {
    firstName: "Victor",
    lastName: "Cardenas",
    fullName: "Victor Cardenas",
    company: "LUXSUA INGENIERÍA S.A.S.",
    role: "CEO & Director de Estructuración de Proyectos",
    department: "Gerencia",
    phone: "+573021066719",
    whatsappNumber: "573021066719",
    email: "gerencia@luxsua.com",
    website: "https://luxsua.com",
    bookingUrl: "https://calendly.com",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    logoUrl: "https://via.placeholder.com/150x50?text=LOGO",
    defaultWaMessage:
      "Hola Victor, vi tu tarjeta digital y me gustaría cotizar un proyecto.",
    tags: ["Proyectos EPC", "Estructuración PPA", "Generación Distribuida"],
  },
  camilo: {
    firstName: "Camilo",
    lastName: "Rendón",
    fullName: "Camilo Rendón Chacón",
    company: "Genera Solutions SAS",
    role: "CEO y Director de Proyectos",
    department: "Dirección Ejecutiva",
    phone: "+573174553388",
    whatsappNumber: "573174553388",
    email: "camilo@generasolutions.com",
    website: "https://generasolutions.com",
    websiteUrl: "https://generasolutions.com",
    portfolioUrl: "https://generasolutions.com/#portafolio",
    instagramUrl: "https://instagram.com/",
    tiktokUrl: "https://tiktok.com/",
    facebookUrl: "https://facebook.com/",
    bookingUrl: "https://calendly.com",
    avatarUrl: "/brand/camilo.jpg",
    logoUrl: "/brand/logo-genera.png",
    defaultWaMessage:
      "Hola Camilo, vi tu tarjeta digital y deseo consultar sobre un proyecto solar.",
    tags: [
      "Energía Solar",
      "Proyectos Fotovoltaicos",
      "Estructuración PPA",
    ],
  },
};

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function qrImageUrl(target: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(target)}`;
}

export default function VCardPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const resolvedParams = use(params);
  const username = resolvedParams.username.toLowerCase();
  const profile = PROFILES_DB[username] || PROFILES_DB.camilo;
  const siteUrl = profile.websiteUrl || profile.website;

  const [qrOpen, setQrOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [savingQr, setSavingQr] = useState(false);
  const [qrError, setQrError] = useState("");

  useEffect(() => {
    if (!qrOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQrOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [qrOpen]);

  const handleDownloadVCF = () => {
    const vcfData = `BEGIN:VCARD
VERSION:3.0
N:${profile.lastName};${profile.firstName};;;
FN:${profile.fullName}
ORG:${profile.company}
TITLE:${profile.role}
TEL;TYPE=CELL:${profile.phone}
EMAIL:${profile.email}
URL:${siteUrl}
END:VCARD`;

    const blob = new Blob([vcfData], { type: "text/vcard;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `${profile.firstName}_${profile.lastName}.vcf`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openQr = () => {
    setCurrentUrl(window.location.href);
    setQrError("");
    setQrOpen(true);
  };

  const handleDownloadQr = async () => {
    if (!currentUrl || savingQr) return;
    setSavingQr(true);
    setQrError("");
    try {
      const response = await fetch(qrImageUrl(currentUrl));
      if (!response.ok) throw new Error("No se pudo generar el código QR.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${profile.firstName}_${profile.lastName}_QR.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      setQrError("No se pudo guardar la imagen. Intenta de nuevo.");
    } finally {
      setSavingQr(false);
    }
  };

  const socialLinks = [
    {
      key: "instagram",
      label: "Instagram",
      href: profile.instagramUrl,
      background:
        "linear-gradient(135deg, #f9ce34 0%, #ee2a7b 55%, #6228d7 100%)",
      icon: <InstagramIcon />,
    },
    {
      key: "tiktok",
      label: "TikTok",
      href: profile.tiktokUrl,
      background: "#111111",
      icon: <TikTokIcon />,
    },
    {
      key: "facebook",
      label: "Facebook",
      href: profile.facebookUrl,
      background: "#1877F2",
      icon: <FacebookIcon />,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      href: profile.linkedinUrl,
      background: "#0A66C2",
      icon: <LinkedInIcon />,
    },
  ].filter((item) => Boolean(item.href));

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <header style={styles.header}>
          <img
            src={profile.logoUrl}
            alt={profile.company}
            style={styles.logo}
          />
          <img
            src={profile.avatarUrl}
            alt={profile.fullName}
            style={styles.avatar}
          />
          <span style={styles.department}>{profile.department}</span>
          <h1 style={styles.name}>{profile.fullName}</h1>
          <p style={styles.role}>{profile.role}</p>
          <p style={styles.company}>{profile.company}</p>
        </header>

        <section style={styles.actions}>
          <button
            type="button"
            onClick={handleDownloadVCF}
            style={styles.btnPrimary}
          >
            Guardar en Contactos (.VCF)
          </button>

          <a
            href={`https://wa.me/${profile.whatsappNumber}?text=${encodeURIComponent(
              profile.defaultWaMessage
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.btnSecondary}
          >
            <div>
              <strong>Enviar WhatsApp</strong>
              <div style={styles.btnSubtitle}>Respuesta comercial directa</div>
            </div>
            <span>WhatsApp</span>
          </a>

          <a
            href={profile.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.btnSecondary}
          >
            <div>
              <strong>Agendar reunión</strong>
              <div style={styles.btnSubtitle}>Abrir calendario en línea</div>
            </div>
            <span>Calendly</span>
          </a>

          {profile.portfolioUrl ? (
            <a
              href={profile.portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.btnFeatured}
            >
              <div>
                <strong>Ver Portafolio Interactivo</strong>
                <div style={styles.btnFeaturedSubtitle}>
                  Proyectos instalados e ingeniería
                </div>
              </div>
              <span style={styles.btnFeaturedMark}>Portafolio</span>
            </a>
          ) : null}

          {siteUrl ? (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.btnSecondary}
            >
              <div>
                <strong>Visitar Sitio Web</strong>
                <div style={styles.btnSubtitle}>{displayHost(siteUrl)}</div>
              </div>
              <span>Web</span>
            </a>
          ) : null}

          <button type="button" onClick={openQr} style={styles.btnQr}>
            <QrIcon />
            Mostrar Código QR
          </button>
        </section>

        {socialLinks.length > 0 ? (
          <section style={styles.socialSection} aria-label="Redes sociales">
            <p style={styles.socialTitle}>Redes sociales</p>
            <div style={styles.socialRow}>
              {socialLinks.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  title={item.label}
                  style={{ ...styles.socialBtn, background: item.background }}
                >
                  {item.icon}
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <section style={styles.tagsSection}>
          <p style={styles.tagsTitle}>Especialidad corporativa</p>
          <div style={styles.tagsContainer}>
            {profile.tags.map((tag) => (
              <span key={tag} style={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        </section>
      </div>

      {qrOpen ? (
        <div
          style={styles.overlay}
          onClick={() => setQrOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-dialog-title"
            style={styles.modal}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h2 id="qr-dialog-title" style={styles.modalTitle}>
                Código QR
              </h2>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                style={styles.modalClose}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <p style={styles.modalText}>
              Escanea este código en ferias o eventos para abrir esta tarjeta.
            </p>
            <div style={styles.qrFrame}>
              <img
                src={qrImageUrl(currentUrl)}
                alt={`Código QR de ${profile.fullName}`}
                style={styles.qrImage}
              />
            </div>
            <p style={styles.qrUrl}>{currentUrl}</p>
            {qrError ? <p style={styles.qrError}>{qrError}</p> : null}
            <button
              type="button"
              onClick={handleDownloadQr}
              style={styles.btnPrimary}
              disabled={savingQr}
            >
              {savingQr ? "Guardando…" : "Guardar imagen del QR"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.6 3.2c.4 2.3 1.7 4 3.9 4.5v2.5c-1.3-.1-2.6-.5-3.7-1.2v6.7c0 3.3-2.6 5.8-5.8 5.8S3.2 19 3.2 15.7c0-3.2 2.5-5.6 5.6-5.8v2.6c-1.7.2-3 1.6-3 3.2 0 1.8 1.5 3.2 3.3 3.2s3.2-1.4 3.2-3.2V3.2h2.3z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.2 8.6h2.6V5.8h-2.6c-2.1 0-3.7 1.7-3.7 3.8v1.8H8.2v2.8h2.3V20h3.1v-5.8h2.4l.4-2.8h-2.8V9.7c0-.6.4-1.1 1.1-1.1z"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.2 9.1H3.5V20h2.7V9.1zM4.85 3.6c-1 0-1.75.8-1.75 1.75S3.85 7.1 4.85 7.1 6.6 6.3 6.6 5.35 5.85 3.6 4.85 3.6zM20.5 13.4c0-2.7-1.5-4-3.4-4-1.5 0-2.3.8-2.7 1.5V9.1h-2.6V20h2.7v-5.7c0-.3 0-.6.1-.9.3-.7.9-1.4 2-1.4 1.4 0 2 .9 2 2.4V20h2.7v-6.6z"
      />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm10-2h2v2h-2v-2zm2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm4 0h2v4h-2v-2h-2v2h-2v-2h2v-2zm2 4h2v2h-2v-2z"
      />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    width: "100%",
    backgroundColor: "#090d16",
    color: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "1.5rem",
    boxSizing: "border-box",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    marginTop: "auto",
    marginBottom: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  header: {
    textAlign: "center",
  },
  logo: {
    height: 96,
    width: "auto",
    maxWidth: "100%",
    objectFit: "contain",
    margin: "0 auto 1.25rem",
    display: "block",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    objectFit: "cover",
    display: "block",
    margin: "0 auto 1rem",
    border: "3px solid #6dbe45",
  },
  department: {
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#6dbe45",
    fontWeight: 600,
  },
  name: {
    fontSize: "1.75rem",
    fontWeight: "bold",
    margin: "0.25rem 0",
  },
  role: {
    fontSize: "0.9rem",
    color: "#94a3b8",
    margin: 0,
  },
  company: {
    fontSize: "0.85rem",
    color: "#64748b",
    marginTop: "0.25rem",
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  btnPrimary: {
    backgroundColor: "#6dbe45",
    color: "#090d16",
    border: "none",
    padding: "0.85rem 1rem",
    borderRadius: "0.75rem",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontFamily: "inherit",
  },
  btnSecondary: {
    backgroundColor: "#1e293b",
    color: "#ffffff",
    textDecoration: "none",
    padding: "0.85rem 1rem",
    borderRadius: "0.75rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid #334155",
    gap: "0.75rem",
  },
  btnFeatured: {
    background: "linear-gradient(135deg, #8ed15a 0%, #6dbe45 45%, #4e9e32 100%)",
    color: "#090d16",
    textDecoration: "none",
    padding: "1rem 1rem",
    borderRadius: "0.9rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "0.75rem",
    boxShadow: "0 10px 28px rgba(109, 190, 69, 0.28)",
  },
  btnFeaturedSubtitle: {
    fontSize: "0.75rem",
    color: "rgba(9, 13, 22, 0.72)",
    fontWeight: 600,
    marginTop: "0.15rem",
  },
  btnFeaturedMark: {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    flexShrink: 0,
  },
  btnSubtitle: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    marginTop: "0.15rem",
  },
  btnQr: {
    backgroundColor: "transparent",
    color: "#6dbe45",
    border: "1px solid rgba(109, 190, 69, 0.75)",
    padding: "0.85rem 1rem",
    borderRadius: "0.75rem",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "0.95rem",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
  },
  socialSection: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    border: "1px solid #334155",
    borderRadius: "0.75rem",
    padding: "1rem",
  },
  socialRow: {
    display: "flex",
    justifyContent: "center",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  socialBtn: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    textDecoration: "none",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
  },
  tagsSection: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    border: "1px solid #334155",
    borderRadius: "0.75rem",
    padding: "1rem",
  },
  socialTitle: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    margin: "0 0 0.75rem 0",
    textAlign: "center",
  },
  tagsTitle: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    margin: "0 0 0.5rem 0",
  },
  tagsContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  tag: {
    fontSize: "0.75rem",
    backgroundColor: "#334155",
    color: "#cbd5e1",
    padding: "0.25rem 0.6rem",
    borderRadius: "1rem",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(2, 6, 16, 0.78)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.25rem",
    zIndex: 40,
    overflowY: "auto",
  },
  modal: {
    width: "100%",
    maxWidth: "360px",
    boxSizing: "border-box",
    backgroundColor: "#111827",
    border: "1px solid #334155",
    borderRadius: "1rem",
    padding: "1.15rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.85rem",
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.45)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  modalTitle: {
    margin: 0,
    fontSize: "1.15rem",
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: "999px",
    border: "1px solid #334155",
    backgroundColor: "#1e293b",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "1.35rem",
    lineHeight: 1,
    fontFamily: "inherit",
  },
  modalText: {
    margin: 0,
    color: "#94a3b8",
    fontSize: "0.85rem",
    lineHeight: 1.45,
  },
  qrFrame: {
    backgroundColor: "#ffffff",
    borderRadius: "0.9rem",
    padding: "0.75rem",
    alignSelf: "center",
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  qrImage: {
    display: "block",
    width: "min(250px, 100%)",
    height: "auto",
  },
  qrUrl: {
    margin: 0,
    color: "#64748b",
    fontSize: "0.72rem",
    textAlign: "center",
    wordBreak: "break-all",
  },
  qrError: {
    margin: 0,
    color: "#fca5a5",
    fontSize: "0.8rem",
    textAlign: "center",
  },
};

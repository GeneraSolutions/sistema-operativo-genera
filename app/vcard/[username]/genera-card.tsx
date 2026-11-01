"use client";

import { useEffect, useState } from "react";

type GeneraProfile = {
  firstName: string;
  lastName: string;
  fullName: string;
  company: string;
  role: string;
  department?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  website: string;
  bookingUrl?: string;
  avatarUrl: string;
  defaultWaMessage: string;
  tags: string[];
  instagramUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  websiteUrl?: string;
};

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function qrImageUrl(target: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&bgcolor=071018&color=f5c542&margin=10&data=${encodeURIComponent(target)}`;
}

export function GeneraCard({ profile }: { profile: GeneraProfile }) {
  const siteUrl = profile.websiteUrl || profile.website;
  const [pageUrl, setPageUrl] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [savingQr, setSavingQr] = useState(false);

  useEffect(() => {
    setPageUrl(window.location.href);
    const id = "genera-vcard-fonts-v2";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  const saveContact = () => {
    const phoneLine = profile.phone ? `TEL;TYPE=CELL:${profile.phone}\n` : "";
    const emailLine = profile.email ? `EMAIL:${profile.email}\n` : "";
    const vcf = `BEGIN:VCARD
VERSION:3.0
N:${profile.lastName};${profile.firstName};;;
FN:${profile.fullName}
ORG:${profile.company}
TITLE:${profile.role}
${phoneLine}${emailLine}URL:${siteUrl}
END:VCARD`;
    const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${profile.firstName}_${profile.lastName}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const saveQr = async () => {
    if (!pageUrl || savingQr) return;
    setSavingQr(true);
    try {
      const response = await fetch(qrImageUrl(pageUrl));
      if (!response.ok) throw new Error("qr");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${profile.firstName}_${profile.lastName}_QR.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setSavingQr(false);
    }
  };

  const modules = [
    profile.whatsappNumber
      ? {
          key: "wa",
          label: "WhatsApp",
          hint: "Canal directo",
          href: `https://wa.me/${profile.whatsappNumber}?text=${encodeURIComponent(profile.defaultWaMessage)}`,
        }
      : null,
    profile.bookingUrl
      ? { key: "agenda", label: "Agenda", hint: "Reservar hora", href: profile.bookingUrl }
      : null,
    profile.portfolioUrl
      ? { key: "port", label: "Portafolio", hint: "Plantas en operación", href: profile.portfolioUrl }
      : null,
    siteUrl
      ? { key: "web", label: "Web", hint: displayHost(siteUrl), href: siteUrl }
      : null,
  ].filter((item): item is { key: string; label: string; hint: string; href: string } => Boolean(item));

  const socials = [
    profile.instagramUrl
      ? { label: "Instagram", href: profile.instagramUrl, icon: <InstagramIcon /> }
      : null,
    profile.tiktokUrl
      ? { label: "TikTok", href: profile.tiktokUrl, icon: <TikTokIcon /> }
      : null,
    profile.facebookUrl
      ? { label: "Facebook", href: profile.facebookUrl, icon: <FacebookIcon /> }
      : null,
    profile.linkedinUrl
      ? { label: "LinkedIn", href: profile.linkedinUrl, icon: <LinkedInIcon /> }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item != null);

  return (
    <main className="gv">
      <style>{css}</style>
      <div className="gv-field" aria-hidden="true">
        <SolarMesh />
        <div className="gv-sun" />
        <div className="gv-scan" />
      </div>

      <section className="gv-chassis">
        <header className="gv-head">
          <img
            src="/brand/logo-genera-vcard.png"
            alt="Genera Solutions"
            className="gv-logo"
          />
          <div className="gv-status">
            <span className="gv-dot" />
            <span>EN LÍNEA · BOGOTÁ</span>
          </div>
        </header>

        <div className="gv-hero">
          <div className="gv-orbit">
            <div className="gv-hex">
              <img src={profile.avatarUrl} alt={profile.fullName} />
            </div>
          </div>
          <div className="gv-id">
            {profile.department ? (
              <p className="gv-dept">{profile.department}</p>
            ) : (
              <p className="gv-dept">{profile.company}</p>
            )}
            <h1>{profile.fullName}</h1>
            <p className="gv-role">{profile.role}</p>
            {profile.email ? (
              <a className="gv-mail" href={`mailto:${profile.email}`}>
                <MailIcon />
                {profile.email}
              </a>
            ) : null}
            {profile.tags.length > 0 ? (
              <div className="gv-tags">
                {profile.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <button type="button" className="gv-save" onClick={saveContact}>
          <span>Guardar en contactos</span>
          <em>.VCF</em>
        </button>

        <div className="gv-grid">
          {modules.map((item) => (
            <a
              key={item.key}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="gv-mod"
            >
              <small>{item.hint}</small>
              <strong>{item.label}</strong>
            </a>
          ))}
        </div>

        {socials.length > 0 ? (
          <nav className="gv-social" aria-label="Redes sociales">
            {socials.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
                title={item.label}
              >
                {item.icon}
              </a>
            ))}
          </nav>
        ) : null}

        <button
          type="button"
          className="gv-qrbtn"
          onClick={() => setQrOpen((open) => !open)}
        >
          {qrOpen ? "Cerrar código QR" : "Abrir código QR"}
        </button>
        {qrOpen && pageUrl ? (
          <div className="gv-qr">
            <img src={qrImageUrl(pageUrl)} alt={`Código QR de ${profile.fullName}`} />
            <button type="button" onClick={saveQr}>
              {savingQr ? "Exportando…" : "Descargar QR"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 7.5 12 13l8-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M14.6 3.2c.4 2.3 1.7 4 3.9 4.5v2.5c-1.3-.1-2.6-.5-3.7-1.2v6.7c0 3.3-2.6 5.8-5.8 5.8S3.2 19 3.2 15.7c0-3.2 2.5-5.6 5.6-5.8v2.6c-1.7.2-3 1.6-3 3.2 0 1.8 1.5 3.2 3.3 3.2s3.2-1.4 3.2-3.2V3.2h2.3z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M14.2 8.6h2.6V5.8h-2.6c-2.1 0-3.7 1.7-3.7 3.8v1.8H8.2v2.8h2.3V20h3.1v-5.8h2.4l.4-2.8h-2.8V9.7c0-.6.4-1.1 1.1-1.1z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M6.2 9.1H3.5V20h2.7V9.1zM4.85 3.6c-1 0-1.75.8-1.75 1.75S3.85 7.1 4.85 7.1 6.6 6.3 6.6 5.35 5.85 3.6 4.85 3.6zM20.5 13.4c0-2.7-1.5-4-3.4-4-1.5 0-2.3.8-2.7 1.5V9.1h-2.6V20h2.7v-5.7c0-.3 0-.6.1-.9.3-.7.9-1.4 2-1.4 1.4 0 2 .9 2 2.4V20h2.7v-6.6z" />
    </svg>
  );
}

function SolarMesh() {
  return (
    <svg className="gv-mesh" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: 14 }, (_, row) =>
        Array.from({ length: 7 }, (_, col) => {
          const x = col * 68 + (row % 2 === 0 ? 0 : 34);
          const y = row * 58;
          return (
            <polygon
              key={`${row}-${col}`}
              points={`${x + 34},${y} ${x + 68},${y + 19} ${x + 68},${y + 58} ${x + 34},${y + 77} ${x},${y + 58} ${x},${y + 19}`}
              fill="none"
              stroke="rgba(126, 184, 214, 0.11)"
              strokeWidth="1"
            />
          );
        })
      )}
    </svg>
  );
}

const css = `
.gv {
  --ink: #eef6ff;
  --mute: #8aa0b8;
  --gold: #f5c542;
  --cell: #7eb8d6;
  --leaf: #6dbe45;
  --void: #05080f;
  min-height: 100vh;
  background: var(--void);
  color: var(--ink);
  position: relative;
  overflow-x: hidden;
  padding: 28px 16px 56px;
  display: flex;
  justify-content: center;
  font-family: "Space Grotesk", "Avenir Next", sans-serif;
}
.gv-field { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.gv-mesh { width: 100%; height: 100%; opacity: 0.9; }
.gv-sun {
  position: absolute; width: 420px; height: 420px; right: -120px; top: -140px;
  background: radial-gradient(circle, rgba(245,197,66,0.34) 0%, rgba(245,197,66,0.08) 36%, transparent 70%);
  animation: gv-pulse 7s ease-in-out infinite;
}
.gv-scan {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 0%, rgba(126,184,214,0.05) 48%, transparent 52%);
  background-size: 100% 220%;
  animation: gv-scan 9s linear infinite;
}
.gv-chassis {
  position: relative;
  width: 100%;
  max-width: 430px;
  padding: 22px 18px 26px;
  border: 1px solid rgba(126,184,214,0.22);
  background:
    linear-gradient(180deg, rgba(14,24,36,0.86) 0%, rgba(7,12,18,0.92) 100%);
  box-shadow:
    0 0 0 1px rgba(245,197,66,0.08),
    0 30px 80px rgba(0,0,0,0.45),
    inset 0 1px 0 rgba(255,255,255,0.06);
  backdrop-filter: blur(16px);
  clip-path: polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px);
}
.gv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 22px;
}
.gv-logo { height: 58px; width: auto; max-width: 68%; object-fit: contain; }
.gv-status {
  display: flex; align-items: center; gap: 7px;
  font-family: "IBM Plex Mono", monospace;
  font-size: 9px; letter-spacing: 0.14em; color: var(--mute);
}
.gv-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--leaf);
  box-shadow: 0 0 10px var(--leaf);
  animation: gv-blink 2.2s ease-in-out infinite;
}
.gv-hero { display: grid; grid-template-columns: 196px 1fr; gap: 16px; align-items: center; }
.gv-orbit {
  width: 196px; height: 216px; position: relative;
  display: grid; place-items: center;
}
.gv-orbit::before {
  content: "";
  position: absolute; inset: -10px;
  border: 1px dashed rgba(245,197,66,0.7);
  clip-path: polygon(50% 0, 96% 25%, 96% 75%, 50% 100%, 4% 75%, 4% 25%);
  animation: gv-spin 18s linear infinite;
}
.gv-orbit::after {
  content: "";
  position: absolute; width: 22px; height: 22px; right: 6px; top: 10px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff3b0, #f5c542 55%, #c58d12);
  box-shadow: 0 0 18px rgba(245,197,66,0.8);
}
.gv-hex {
  width: 174px; height: 190px;
  clip-path: polygon(50% 0, 96% 25%, 96% 75%, 50% 100%, 4% 75%, 4% 25%);
  box-shadow: 0 0 40px rgba(245,197,66,0.38);
  position: relative;
  overflow: hidden;
}
.gv-hex img {
  width: 118%; height: 118%; object-fit: cover; object-position: center 16%;
  display: block; position: absolute; left: 50%; top: 46%;
  transform: translate(-50%, -50%);
}
.gv-id h1 {
  margin: 0; font-size: 1.72rem; line-height: 1.02; letter-spacing: -0.035em; font-weight: 700;
}
.gv-dept, .gv-role {
  margin: 0; font-family: "IBM Plex Mono", monospace; font-size: 10px;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold);
}
.gv-role { color: var(--mute); margin-top: 8px; letter-spacing: 0.06em; line-height: 1.4; text-transform: none; font-size: 12px; }
.gv-dept { margin-bottom: 8px; }
.gv-mail {
  display: inline-flex; align-items: center; gap: 7px;
  margin-top: 12px; color: var(--gold); text-decoration: none;
  font-family: "IBM Plex Mono", monospace; font-size: 11px;
  border-bottom: 1px solid rgba(245,197,66,0.45); padding-bottom: 3px;
  max-width: 100%; overflow-wrap: anywhere;
}
.gv-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.gv-tags span {
  font-size: 10px; color: var(--cell); border: 1px solid rgba(126,184,214,0.28);
  padding: 3px 7px; letter-spacing: 0.02em;
}
.gv-save {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  border: 0; cursor: pointer; color: #08110a; font-family: inherit; font-weight: 700;
  font-size: 15px; padding: 14px 16px; margin-top: 18px;
  background: linear-gradient(135deg, #f5c542 0%, #6dbe45 100%);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}
.gv-save em { font-style: normal; font-family: "IBM Plex Mono", monospace; font-size: 11px; }
.gv-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px;
}
.gv-mod {
  min-height: 78px; padding: 12px 12px 10px;
  text-decoration: none; color: var(--ink);
  border: 1px solid rgba(126,184,214,0.2);
  background: linear-gradient(180deg, rgba(126,184,214,0.08), rgba(5,8,15,0.2));
  display: flex; flex-direction: column; justify-content: space-between;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  transition: border-color 160ms ease, transform 160ms ease;
}
.gv-mod:hover { border-color: var(--gold); transform: translateY(-2px); }
.gv-mod small { color: var(--mute); font-family: "IBM Plex Mono", monospace; font-size: 10px; }
.gv-mod strong { font-size: 16px; letter-spacing: -0.02em; }
.gv-social { display: flex; gap: 8px; margin-top: 16px; }
.gv-social a {
  flex: 1; min-height: 44px; display: grid; place-items: center;
  text-decoration: none; color: var(--ink);
  border: 1px solid rgba(245,197,66,0.28);
}
.gv-social a:hover { border-color: var(--gold); color: var(--gold); }
.gv-qrbtn {
  margin-top: 16px; width: 100%; background: transparent; color: var(--gold);
  border: 1px solid rgba(245,197,66,0.4); padding: 11px; cursor: pointer;
  font-family: "IBM Plex Mono", monospace; font-size: 11px; letter-spacing: 0.16em;
}
.gv-qr { margin-top: 12px; display: flex; align-items: center; gap: 14px; }
.gv-qr img { width: 120px; height: 120px; background: #071018; }
.gv-qr button {
  background: transparent; color: var(--ink); border: 1px solid rgba(126,184,214,0.35);
  padding: 10px 12px; cursor: pointer; font-family: inherit;
}
@keyframes gv-pulse { 0%,100% { opacity: .7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
@keyframes gv-scan { 0% { background-position: 0 -80%; } 100% { background-position: 0 180%; } }
@keyframes gv-spin { to { transform: rotate(360deg); } }
@keyframes gv-blink { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
@media (max-width: 420px) {
  .gv-hero { grid-template-columns: 1fr; justify-items: center; text-align: center; }
  .gv-id { width: 100%; }
  .gv-tags { justify-content: center; }
  .gv-mail { justify-content: center; }
}
`;

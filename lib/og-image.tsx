import { ImageResponse } from "next/og";
import { generaLogoDataUri } from "@/lib/og-logo";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

export async function renderOgImage(opts: {
  kicker?: string;
  title?: string;
  subtitle?: string;
}) {
  const logo = await generaLogoDataUri();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#070b16",
          padding: 64,
        }}
      >
        {/* Satori exige width y height numéricos para incrustar el logo. */}
        <img src={logo} width={480} height={190} />
        <div
          style={{
            marginTop: 36,
            color: "#d4b46a",
            fontSize: 18,
            letterSpacing: 6,
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          {opts.kicker ?? "Genera Solutions SAS"}
        </div>
        <div
          style={{
            marginTop: 12,
            color: "#ffffff",
            fontSize: 40,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: 980,
          }}
        >
          {opts.title ?? "Sistema Operativo Solar"}
        </div>
        {opts.subtitle ? (
          <div
            style={{
              marginTop: 16,
              color: "#9fb3c8",
              fontSize: 24,
              textAlign: "center",
              maxWidth: 900,
            }}
          >
            {opts.subtitle}
          </div>
        ) : null}
      </div>
    ),
    { ...OG_SIZE }
  );
}

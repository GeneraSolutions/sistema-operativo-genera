"use client";

type BrandLogoProps = {
  height?: number;
  className?: string;
  /** knockout: marca sin fondo, para el header verde. card: logo con fondo negro para la propuesta. */
  variant?: "knockout" | "card";
};

export function BrandLogo({
  height = 48,
  className = "",
  variant = "knockout",
}: BrandLogoProps) {
  const card = variant === "card";

  return (
    <span
      className={`inline-flex items-center ${
        card ? "overflow-hidden rounded-lg bg-black" : ""
      } ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card ? "/brand/logo-genera.jpg" : "/brand/logo-genera-mark.png"}
        alt="Genera Solutions"
        style={{ height, width: "auto" }}
        className={`block max-w-[min(420px,80vw)] object-contain ${
          card ? "bg-black" : "bg-transparent"
        }`}
      />
    </span>
  );
}

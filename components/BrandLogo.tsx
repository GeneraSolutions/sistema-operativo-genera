"use client";

import logo from "./logo-genera.jpg";

type BrandLogoProps = {
  height?: number;
  className?: string;
  /** knockout: quita el blanco sobre fondos claros. card: placa blanca para fondos oscuros. */
  variant?: "knockout" | "card";
};

export function BrandLogo({
  height = 48,
  className = "",
  variant = "knockout",
}: BrandLogoProps) {
  const src = typeof logo === "string" ? logo : logo.src;
  const card = variant === "card";

  return (
    <span
      className={`inline-flex items-center ${
        card ? "rounded-2xl bg-white px-3 py-2 shadow-sm" : ""
      } ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Genera Solutions"
        style={{
          height,
          width: "auto",
          mixBlendMode: card ? "normal" : "multiply",
        }}
        className="block max-w-[min(420px,80vw)] bg-transparent object-contain"
      />
    </span>
  );
}

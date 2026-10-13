"use client";

type BrandLogoProps = {
  height?: number;
  className?: string;
  /** card: propuesta oscura; knockout: header del OS. Ambos usan la marca sin fondo. */
  variant?: "knockout" | "card";
};

export function BrandLogo({
  height = 48,
  className = "",
}: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-genera-mark.png"
        alt="Genera Solutions"
        style={{ height, width: "auto" }}
        className="block max-w-[min(420px,80vw)] bg-transparent object-contain"
      />
    </span>
  );
}

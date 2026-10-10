"use client";

import logo from "./logo-genera.jpg";

type BrandLogoProps = {
  height?: number;
  className?: string;
};

export function BrandLogo({ height = 48, className = "" }: BrandLogoProps) {
  const src = typeof logo === "string" ? logo : logo.src;

  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Genera Solutions"
        style={{ height, width: "auto", mixBlendMode: "multiply" }}
        className="block max-w-[240px] bg-transparent object-contain"
      />
    </span>
  );
}

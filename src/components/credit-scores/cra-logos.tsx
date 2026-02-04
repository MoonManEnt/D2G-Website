"use client";

import Image from "next/image";

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

const CRA_LOGOS: Record<string, { src: string; alt: string }> = {
  TRANSUNION: { src: "/logos/transunion.svg", alt: "TransUnion" },
  EXPERIAN: { src: "/logos/experian.svg", alt: "Experian" },
  EQUIFAX: { src: "/logos/equifax.svg", alt: "Equifax" },
};

/**
 * Renders the official CRA logo for a given bureau name
 */
export function CRALogo({ cra, className, width = 120, height = 28 }: LogoProps & { cra: string }) {
  const logo = CRA_LOGOS[cra.toUpperCase()];

  if (!logo) {
    return <span className="text-sm font-bold text-muted-foreground">{cra}</span>;
  }

  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}

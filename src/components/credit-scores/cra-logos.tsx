"use client";

import Image from "next/image";

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

/**
 * TransUnion - teal wordmark with circled "tu" icon
 * Official brand color: #00AEEF
 */
function TransUnionLogo({ className, width = 130, height = 32 }: LogoProps) {
  return (
    <svg
      viewBox="0 0 320 80"
      width={width}
      height={height}
      className={className}
      aria-label="TransUnion"
      role="img"
    >
      {/* "tu" circle icon */}
      <g transform="translate(268, 6)">
        <circle cx="22" cy="22" r="20" fill="none" stroke="#00AEEF" strokeWidth="4" />
        <text
          x="22" y="30"
          textAnchor="middle"
          fontFamily="'Segoe UI', Arial, sans-serif"
          fontStyle="italic"
          fontWeight="600"
          fontSize="26"
          fill="#00AEEF"
        >
          tu
        </text>
      </g>
      {/* Wordmark */}
      <text
        x="2" y="68"
        fontFamily="'Segoe UI', Arial, Helvetica, sans-serif"
        fontWeight="600"
        fontSize="52"
        fill="#00AEEF"
        letterSpacing="-1"
      >
        TransUnion
      </text>
      <text x="256" y="72" fontFamily="Arial, sans-serif" fontSize="12" fill="#00AEEF">
        &#174;
      </text>
    </svg>
  );
}

/**
 * Experian - official logo image
 */
function ExperianLogo({ className, width = 130, height = 32 }: LogoProps) {
  return (
    <Image
      src="/logos/experian.webp"
      alt="Experian"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}

/**
 * Equifax - crimson red bold italic "EQUIFAX"
 * Official brand color: #B7233F
 */
function EquifaxLogo({ className, width = 130, height = 32 }: LogoProps) {
  return (
    <svg
      viewBox="0 0 320 62"
      width={width}
      height={height}
      className={className}
      aria-label="Equifax"
      role="img"
    >
      <text
        x="4" y="54"
        fontFamily="'Arial Black', 'Segoe UI Black', Arial, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="62"
        fill="#C82A3E"
        letterSpacing="1"
      >
        EQUIFAX
      </text>
    </svg>
  );
}

/**
 * Renders the appropriate official CRA logo for a given bureau name
 */
export function CRALogo({ cra, ...props }: LogoProps & { cra: string }) {
  switch (cra.toUpperCase()) {
    case "TRANSUNION":
      return <TransUnionLogo {...props} />;
    case "EXPERIAN":
      return <ExperianLogo {...props} />;
    case "EQUIFAX":
      return <EquifaxLogo {...props} />;
    default:
      return <span className="text-sm font-bold text-muted-foreground">{cra}</span>;
  }
}

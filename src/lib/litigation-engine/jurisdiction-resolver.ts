/**
 * Jurisdiction Resolver
 *
 * Resolves jurisdiction details (federal district, small claims limits,
 * state AG addresses, service requirements) and recommends a court type
 * based on estimated damages and violation profile.
 */

import type {
  CourtType,
  FederalDistrict,
  JurisdictionInfo,
  ServiceRequirements,
  SmallClaimsInfo,
  StateAGInfo,
} from "./types";

import {
  FEDERAL_DISTRICTS,
  SMALL_CLAIMS_LIMITS,
  STATE_AG_ADDRESSES,
  SERVICE_REQUIREMENTS,
  FTC_COMPLAINT_INFO,
} from "./jurisdiction-data";

// ============================================================================
// Zip-prefix-to-district mapping for major multi-district states
// ============================================================================

interface ZipDistrictRange {
  zipMin: number;
  zipMax: number;
  districtShortName: string;
}

/**
 * Approximate zip-prefix ranges for states with multiple federal districts.
 * Zip prefixes are the first three digits of the zip code.
 */
const ZIP_DISTRICT_MAP: Record<string, ZipDistrictRange[]> = {
  CA: [
    { zipMin: 900, zipMax: 935, districtShortName: "C.D. Cal." },
    { zipMin: 936, zipMax: 966, districtShortName: "N.D. Cal." },
  ],
  NY: [
    { zipMin: 100, zipMax: 104, districtShortName: "S.D.N.Y." },
    { zipMin: 110, zipMax: 119, districtShortName: "E.D.N.Y." },
    { zipMin: 120, zipMax: 149, districtShortName: "N.D.N.Y." },
  ],
  TX: [
    { zipMin: 750, zipMax: 755, districtShortName: "N.D. Tex." },
    { zipMin: 756, zipMax: 759, districtShortName: "E.D. Tex." },
    { zipMin: 760, zipMax: 769, districtShortName: "N.D. Tex." },
    { zipMin: 770, zipMax: 779, districtShortName: "S.D. Tex." },
    { zipMin: 780, zipMax: 799, districtShortName: "W.D. Tex." },
  ],
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Parse the 3-digit zip prefix from a zip code string.
 * Returns NaN if the zip code is invalid.
 */
function getZipPrefix(zipCode: string): number {
  const cleaned = zipCode.replace(/\D/g, "");
  if (cleaned.length < 3) return NaN;
  return parseInt(cleaned.substring(0, 3), 10);
}

/**
 * Look up the federal district for a state, optionally narrowing by zip prefix
 * for states with multiple districts.
 */
function lookupFederalDistrict(
  state: string,
  zipCode?: string
): FederalDistrict {
  const stateUpper = state.toUpperCase();
  const districts = FEDERAL_DISTRICTS[stateUpper as keyof typeof FEDERAL_DISTRICTS];

  if (!districts) {
    // Fallback: return a generic placeholder
    return {
      name: `U.S. District Court — ${stateUpper}`,
      shortName: `D. ${stateUpper}`,
      courtAddress: "Unknown",
      filingFee: 40500, // $405 in cents
    };
  }

  // Single district — return it directly
  if (districts.length === 1) {
    return districts[0];
  }

  // Multiple districts — try zip-prefix matching if zip code is provided
  if (zipCode && ZIP_DISTRICT_MAP[stateUpper]) {
    const prefix = getZipPrefix(zipCode);
    if (!isNaN(prefix)) {
      const ranges = ZIP_DISTRICT_MAP[stateUpper];
      for (const range of ranges) {
        if (prefix >= range.zipMin && prefix <= range.zipMax) {
          const matched = districts.find(
            (d) => d.shortName === range.districtShortName
          );
          if (matched) return matched;
        }
      }
    }
  }

  // Default: first district in the list
  return districts[0];
}

/**
 * Look up small claims info for a state.
 */
function lookupSmallClaims(state: string): SmallClaimsInfo {
  const stateUpper = state.toUpperCase() as keyof typeof SMALL_CLAIMS_LIMITS;
  const info = SMALL_CLAIMS_LIMITS[stateUpper];

  if (!info) {
    // Conservative fallback
    return {
      limit: 500000, // $5,000 in cents
      filingFeeMin: 3000, // $30
      filingFeeMax: 7500, // $75
      notes: "Small claims limit could not be determined for this state.",
    };
  }

  return info;
}

// ============================================================================
// Exported functions
// ============================================================================

/**
 * Resolve full jurisdiction info for a given state/zip/county.
 * Selects the appropriate federal district, small claims info, AG address,
 * and recommends a court type based on estimated damages.
 */
export function resolveJurisdiction(
  state: string,
  zipCode?: string,
  county?: string,
  estimatedDamagesMax?: number // cents
): JurisdictionInfo {
  const stateUpper = state.toUpperCase();

  const federalDistrict = lookupFederalDistrict(stateUpper, zipCode);
  const smallClaims = lookupSmallClaims(stateUpper);
  const stateAG = getStateAGAddress(stateUpper) ?? {
    name: "State Attorney General",
    divisionName: "Consumer Protection Division",
    addressLine1: "Unknown",
    city: "Unknown",
    state: stateUpper,
    zipCode: "00000",
  };
  const serviceRequirements = getServiceRequirements(stateUpper);

  const recommendedCourtType = estimatedDamagesMax
    ? recommendCourtType(estimatedDamagesMax, stateUpper)
    : "STATE";

  const filingFeeEstimate = getFilingFeeEstimate(
    recommendedCourtType,
    stateUpper
  );

  return {
    state: stateUpper,
    county,
    zipCode,
    federalDistrict,
    smallClaims,
    stateAG,
    serviceRequirements,
    recommendedCourtType,
    filingFeeEstimate,
  };
}

/**
 * Recommend best court type based on damages and state.
 * - Under small claims limit -> SMALL_CLAIMS
 * - Any FCRA violations (federal statute) -> FEDERAL (preferred)
 * - Otherwise -> STATE
 */
export function recommendCourtType(
  estimatedDamagesMax: number, // cents
  state: string,
  hasFCRAViolations?: boolean
): CourtType {
  const stateUpper = state.toUpperCase();
  const smallClaims = lookupSmallClaims(stateUpper);

  if (estimatedDamagesMax <= smallClaims.limit) {
    return "SMALL_CLAIMS";
  }

  if (hasFCRAViolations) {
    return "FEDERAL";
  }

  return "STATE";
}

/**
 * Get filing fee estimate for a given court type and state.
 * Federal: $405 flat. State/small claims: from jurisdiction data.
 */
export function getFilingFeeEstimate(
  courtType: CourtType,
  state: string
): number {
  const stateUpper = state.toUpperCase();

  if (courtType === "FEDERAL") {
    // Federal filing fee is a standard $405 (40500 cents)
    return 40500;
  }

  const smallClaims = lookupSmallClaims(stateUpper);

  if (courtType === "SMALL_CLAIMS") {
    // Return the midpoint of the small claims filing fee range
    return Math.round(
      (smallClaims.filingFeeMin + smallClaims.filingFeeMax) / 2
    );
  }

  // STATE court — use the max small claims filing fee as a rough proxy
  // (state court filing fees are generally higher; this is a conservative estimate)
  return smallClaims.filingFeeMax;
}

/**
 * Get service of process requirements for a state.
 */
export function getServiceRequirements(state: string): ServiceRequirements {
  const stateUpper = state.toUpperCase() as keyof typeof SERVICE_REQUIREMENTS;
  const requirements = SERVICE_REQUIREMENTS[stateUpper];

  if (!requirements) {
    // Conservative default
    return {
      personalService: true,
      substitutedService: false,
      certifiedMailAccepted: false,
      responseDeadlineDays: 30,
      notes:
        "Service requirements could not be determined for this state. Personal service is recommended.",
    };
  }

  return requirements;
}

/**
 * Get state attorney general's office address.
 */
export function getStateAGAddress(state: string): StateAGInfo | null {
  const stateUpper = state.toUpperCase() as keyof typeof STATE_AG_ADDRESSES;
  return STATE_AG_ADDRESSES[stateUpper] ?? null;
}

/**
 * Get FTC complaint filing info.
 */
export function getFTCComplaintInfo(): typeof FTC_COMPLAINT_INFO {
  return FTC_COMPLAINT_INFO;
}

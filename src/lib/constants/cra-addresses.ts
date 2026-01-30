/**
 * Credit Reporting Agency (CRA) Mailing Addresses
 *
 * Centralized addresses for dispute letter mailing.
 * Used by DocuPost, Lob, and PDF generation services.
 */

export interface CRAAddress {
  name: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
}

export const CRA_ADDRESSES: Record<string, CRAAddress> = {
  TRANSUNION: {
    name: "TransUnion LLC Consumer Dispute Center",
    address1: "P.O. Box 2000",
    city: "Chester",
    state: "PA",
    zip: "19016",
  },
  EXPERIAN: {
    name: "Experian",
    address1: "P.O. Box 4500",
    city: "Allen",
    state: "TX",
    zip: "75013",
  },
  EQUIFAX: {
    name: "Equifax Information Services LLC",
    address1: "P.O. Box 740256",
    city: "Atlanta",
    state: "GA",
    zip: "30374",
  },
} as const;

export type CRAKey = keyof typeof CRA_ADDRESSES;

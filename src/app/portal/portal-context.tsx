"use client";

import { createContext, useContext } from "react";

export interface PortalUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface PortalOrganization {
  id: string;
  name: string;
}

export interface PortalContextType {
  user: PortalUser | null;
  organization: PortalOrganization | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string, user: PortalUser, organization: PortalOrganization) => void;
  logout: () => void;
  getAuthHeader: () => string | null;
}

export const PortalContext = createContext<PortalContextType | undefined>(undefined);

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error("usePortal must be used within PortalProvider");
  }
  return context;
}

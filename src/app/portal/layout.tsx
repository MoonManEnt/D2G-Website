"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PortalContext, PortalUser, PortalOrganization } from "./portal-context";

const PUBLIC_PATHS = ["/portal/login", "/portal/accept-invite", "/portal/forgot-password"];
const TOKEN_REFRESH_INTERVAL = 50 * 60 * 1000; // Refresh 10 minutes before expiry (50 min)

export default function PortalLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [organization, setOrganization] = useState<PortalOrganization | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Refresh access token
  const refreshAccessToken = useCallback(async () => {
    const storedRefreshToken = localStorage.getItem("portal_refresh_token");
    if (!storedRefreshToken) return false;

    try {
      const res = await fetch("/api/portal/auth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (res.ok) {
        const data = await res.json();
        setAccessToken(data.accessToken);
        localStorage.setItem("portal_access_token", data.accessToken);
        return true;
      } else {
        // Refresh token invalid, clear everything
        logout();
        return false;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      return false;
    }
  }, []);

  // Initialize from localStorage
  useEffect(() => {
    const storedAccessToken = localStorage.getItem("portal_access_token");
    const storedRefreshToken = localStorage.getItem("portal_refresh_token");
    const storedUser = localStorage.getItem("portal_user");
    const storedOrg = localStorage.getItem("portal_organization");

    if (storedAccessToken && storedRefreshToken && storedUser && storedOrg) {
      setAccessToken(storedAccessToken);
      setRefreshToken(storedRefreshToken);
      setUser(JSON.parse(storedUser));
      setOrganization(JSON.parse(storedOrg));

      // Proactively refresh token on load
      refreshAccessToken();
    }

    setIsLoading(false);
  }, [refreshAccessToken]);

  // Set up token refresh interval
  useEffect(() => {
    if (!refreshToken) return;

    const interval = setInterval(() => {
      refreshAccessToken();
    }, TOKEN_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [refreshToken, refreshAccessToken]);

  // Handle route protection
  useEffect(() => {
    if (!isLoading) {
      const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

      if (!accessToken && !isPublicPath) {
        router.push("/portal/login");
      } else if (accessToken && pathname === "/portal/login") {
        router.push("/portal/dashboard");
      }
    }
  }, [isLoading, accessToken, pathname, router]);

  const login = (
    newAccessToken: string,
    newRefreshToken: string,
    newUser: PortalUser,
    newOrg: PortalOrganization
  ) => {
    setAccessToken(newAccessToken);
    setRefreshToken(newRefreshToken);
    setUser(newUser);
    setOrganization(newOrg);

    localStorage.setItem("portal_access_token", newAccessToken);
    localStorage.setItem("portal_refresh_token", newRefreshToken);
    localStorage.setItem("portal_user", JSON.stringify(newUser));
    localStorage.setItem("portal_organization", JSON.stringify(newOrg));
  };

  const logout = () => {
    // Call logout API (fire and forget)
    fetch("/api/portal/auth", { method: "DELETE" }).catch(() => {});

    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setOrganization(null);

    localStorage.removeItem("portal_access_token");
    localStorage.removeItem("portal_refresh_token");
    localStorage.removeItem("portal_user");
    localStorage.removeItem("portal_organization");

    router.push("/portal/login");
  };

  const getAuthHeader = () => {
    return accessToken ? `Bearer ${accessToken}` : null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PortalContext.Provider
      value={{ user, organization, accessToken, isLoading, login, logout, getAuthHeader }}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {children}
      </div>
    </PortalContext.Provider>
  );
}

/**
 * Dispute2Go Mobile App
 *
 * React Native application for credit dispute specialists.
 */

import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { useAuth } from "./src/hooks/useAuth";

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// Main App Component
function AppContent() {
  const { checkAuth, isLoading } = useAuth();

  useEffect(() => {
    // Check authentication status on mount
    checkAuth().finally(() => {
      SplashScreen.hideAsync();
    });
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}

// App with Providers
export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

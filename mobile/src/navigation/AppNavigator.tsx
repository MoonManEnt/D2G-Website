/**
 * App Navigation Structure
 */

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../hooks/useAuth";
import { RootStackParamList, MainTabParamList } from "../types";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

// Screens
import { LoginScreen } from "../screens/LoginScreen";
import { DashboardScreen } from "../screens/DashboardScreen";

// Placeholder screens (to be implemented)
function ClientsScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Clients</Text>
    </View>
  );
}

function DisputesScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Disputes</Text>
    </View>
  );
}

function ProfileScreen() {
  const { logout } = useAuth();

  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Profile</Text>
      <Text style={styles.logoutButton} onPress={logout}>
        Logout
      </Text>
    </View>
  );
}

// Navigation Stacks
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Main Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#1e293b",
          borderTopColor: "#334155",
        },
        tabBarActiveTintColor: "#7c3aed",
        tabBarInactiveTintColor: "#71717a",
        headerStyle: {
          backgroundColor: "#0f172a",
        },
        headerTintColor: "#ffffff",
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <TabIcon name="D" color={color} />,
        }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{
          title: "Clients",
          tabBarIcon: ({ color }) => <TabIcon name="C" color={color} />,
        }}
      />
      <Tab.Screen
        name="Disputes"
        component={DisputesScreen}
        options={{
          title: "Disputes",
          tabBarIcon: ({ color }) => <TabIcon name="D" color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon name="P" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Simple tab icon (replace with actual icons)
function TabIcon({ name, color }: { name: string; color: string }) {
  return (
    <View style={[styles.tabIcon, { borderColor: color }]}>
      <Text style={[styles.tabIconText, { color }]}>{name}</Text>
    </View>
  );
}

// Root Navigator
export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  placeholderText: {
    fontSize: 24,
    color: "#ffffff",
  },
  logoutButton: {
    marginTop: 24,
    color: "#ef4444",
    fontSize: 16,
  },
  tabIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  tabIconText: {
    fontSize: 12,
    fontWeight: "bold",
  },
});

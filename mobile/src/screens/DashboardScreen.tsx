/**
 * Dashboard Screen
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getAnalytics, getDisputes } from "../services/api";
import { useAuth } from "../hooks/useAuth";

export function DashboardScreen() {
  const { user } = useAuth();

  const {
    data: analytics,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const response = await getAnalytics();
      return response.data;
    },
  });

  const {
    data: recentDisputes,
    isLoading: disputesLoading,
    refetch: refetchDisputes,
  } = useQuery({
    queryKey: ["disputes", "recent"],
    queryFn: async () => {
      const response = await getDisputes(1, 5);
      return response.data?.items || [];
    },
  });

  const isLoading = analyticsLoading || disputesLoading;

  const handleRefresh = async () => {
    await Promise.all([refetchAnalytics(), refetchDisputes()]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={handleRefresh}
          tintColor="#7c3aed"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Welcome back, {user?.name?.split(" ")[0] || "User"}
        </Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {analytics?.summary?.clientCount || 0}
          </Text>
          <Text style={styles.statLabel}>Active Clients</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {analytics?.summary?.activeDisputeCount || 0}
          </Text>
          <Text style={styles.statLabel}>Active Disputes</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {analytics?.summary?.resolvedDisputeCount || 0}
          </Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.successValue]}>
            {analytics?.summary?.resolutionRate || 0}%
          </Text>
          <Text style={styles.statLabel}>Success Rate</Text>
        </View>
      </View>

      {/* Recent Disputes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Disputes</Text>

        {recentDisputes?.map((dispute) => (
          <TouchableOpacity key={dispute.id} style={styles.disputeCard}>
            <View style={styles.disputeHeader}>
              <Text style={styles.disputeClient}>{dispute.clientName}</Text>
              <View style={[styles.statusBadge, getStatusStyle(dispute.status)]}>
                <Text style={styles.statusText}>
                  {formatStatus(dispute.status)}
                </Text>
              </View>
            </View>
            <View style={styles.disputeDetails}>
              <Text style={styles.disputeInfo}>
                {dispute.cra} • Round {dispute.round}
              </Text>
              <Text style={styles.disputeDate}>
                {new Date(dispute.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {(!recentDisputes || recentDisputes.length === 0) && !isLoading && (
          <Text style={styles.emptyText}>No recent disputes</Text>
        )}
      </View>
    </ScrollView>
  );
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

function getStatusStyle(status: string) {
  switch (status) {
    case "RESOLVED_POSITIVE":
      return { backgroundColor: "#22c55e" };
    case "RESOLVED_NEGATIVE":
      return { backgroundColor: "#ef4444" };
    case "SENT":
      return { backgroundColor: "#3b82f6" };
    default:
      return { backgroundColor: "#71717a" };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: "#a1a1aa",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    width: "48%",
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  successValue: {
    color: "#22c55e",
  },
  statLabel: {
    fontSize: 12,
    color: "#a1a1aa",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 12,
  },
  disputeCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  disputeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  disputeClient: {
    fontSize: 16,
    fontWeight: "500",
    color: "#ffffff",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  disputeDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  disputeInfo: {
    fontSize: 14,
    color: "#a1a1aa",
  },
  disputeDate: {
    fontSize: 14,
    color: "#71717a",
  },
  emptyText: {
    color: "#71717a",
    textAlign: "center",
    padding: 16,
  },
});

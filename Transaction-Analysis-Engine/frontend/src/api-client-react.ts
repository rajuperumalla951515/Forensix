import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";


export enum TransactionStatus {
  flagged = "flagged",
  cleared = "cleared",
  blocked = "blocked",
  pending = "pending",
}
export enum TransactionRiskLevel {
  low = "low",
  medium = "medium",
  high = "high",
  critical = "critical",
}
export enum AlertSeverity {
  low = "low",
  medium = "medium",
  high = "high",
  critical = "critical",
}
export enum AlertStatus {
  open = "open",
  investigating = "investigating",
  resolved = "resolved",
  dismissed = "dismissed",
}
export enum FraudCaseStatus {
  open = "open",
  investigating = "investigating",
  pending_review = "pending_review",
  closed = "closed",
  escalated = "escalated",
}
export enum CustomerStatus {
  active = "active",
  suspended = "suspended",
  blocked = "blocked",
  under_review = "under_review",
}
export enum CustomerRiskLevel {
  low = "low",
  medium = "medium",
  high = "high",
  critical = "critical",
}

type QueryOpts = Record<string, string | number | undefined>;
const get = async <T>(url: string, params?: QueryOpts): Promise<T> => (await api.get(url, { params })).data;

export const getGetAlertsQueryKey = () => ["/alerts"];
export const getGetDashboardKpisQueryKey = () => ["/dashboard/kpis"];

export const useGetDashboardKpis = () =>
  useQuery({ queryKey: ["/dashboard/kpis"], queryFn: () => get("/dashboard/kpis") });
export const useGetDashboardRecentAlerts = () =>
  useQuery({ queryKey: ["/dashboard/recent-alerts"], queryFn: () => get("/dashboard/recent-alerts") });
export const useGetTransactions = (params: QueryOpts) =>
  useQuery({ queryKey: ["/transactions", params], queryFn: () => get("/transactions", params) });
export const useGetAlerts = (params?: QueryOpts) =>
  useQuery({ queryKey: ["/alerts", params], queryFn: () => get("/alerts", params) });
export const useGetCases = () =>
  useQuery({ queryKey: ["/cases"], queryFn: () => get("/cases") });
export const useGetCustomers = (params?: QueryOpts) =>
  useQuery({ queryKey: ["/customers", params], queryFn: () => get("/customers", params) });
export const useGetFundFlowGraph = (params?: QueryOpts) =>
  useQuery({ queryKey: ["/fund-flow/graph", params], queryFn: () => get("/fund-flow/graph", params) });
export const useGetReportsSummary = () =>
  useQuery({ queryKey: ["/reports/summary"], queryFn: () => get("/reports/summary") });

export function useUpdateAlertStatus(options?: { mutation?: { onSuccess?: () => void } }) {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { status: AlertStatus } }) =>
      (await api.patch(`/alerts/${id}/status`, data)).data,
    onSuccess: () => options?.mutation?.onSuccess?.(),
  });
}

export interface ImportCsvResult {
  imported: number;
  alerts: any[];
  graphData: { nodes: any[]; edges: any[] };
  transactions: any[];
  summary: {
    total: number;
    blocked: number;
    flagged: number;
    cleared: number;
    totalValue: number;
    avgRiskScore: number;
  };
}

export const importCsvTransactions = async (payload: { transactions: any[] }): Promise<ImportCsvResult> =>
  (await api.post("/transactions/import-csv", payload)).data;

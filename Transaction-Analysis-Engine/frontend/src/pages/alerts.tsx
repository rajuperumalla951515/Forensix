import { useState } from "react";
import { useGetAlerts, useUpdateAlertStatus, AlertStatus, AlertSeverity } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { LoadingState, ErrorState } from "@/components/ui/loading-state";
import { SeverityBadge, AlertStatusBadge } from "@/components/status-badges";
import { format } from "date-fns";
import { Filter, Check, ShieldAlert, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAlertsQueryKey, getGetDashboardKpisQueryKey } from "@workspace/api-client-react";

export default function AlertsPage() {
  const [severity, setSeverity] = useState<AlertSeverity | "all">("all");
  const [status, setStatus] = useState<AlertStatus | "all">("all");
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useGetAlerts({
    ...(severity !== "all" && { severity }),
    ...(status !== "all" && { status })
  });

  const { mutate: updateStatus, isPending } = useUpdateAlertStatus({
    mutation: {
      onSuccess: () => {
        // Invalidate both lists and KPIs when an alert status changes
        queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardKpisQueryKey() });
      }
    }
  });

  const handleStatusChange = (id: string, newStatus: AlertStatus) => {
    updateStatus({ id, data: { status: newStatus } });
  };

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">Security Alerts</h1>
          <p className="text-muted-foreground">Manage and triage active fraud warnings triggered by the rules engine.</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative bg-card border border-border rounded-xl">
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AlertSeverity | "all")}
              className="appearance-none bg-transparent py-2.5 pl-4 pr-10 text-sm text-foreground outline-none cursor-pointer w-full"
            >
              <option value="all">All Severities</option>
              {Object.values(AlertSeverity).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative bg-card border border-border rounded-xl">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AlertStatus | "all")}
              className="appearance-none bg-transparent py-2.5 pl-4 pr-10 text-sm text-foreground outline-none cursor-pointer w-full"
            >
              <option value="all">All Statuses</option>
              {Object.values(AlertStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error as Error} />
      ) : !data || data.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground rounded-2xl flex flex-col items-center">
          <ShieldAlert className="w-16 h-16 mb-4 opacity-20" />
          <h3 className="text-lg font-medium text-foreground mb-2">No alerts found</h3>
          <p>You're all caught up! No alerts match your current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {data.map((alert, i) => (
              <motion.div
                key={alert.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card rounded-2xl p-6 border border-white/5 hover:border-primary/20 transition-all flex flex-col h-full group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <SeverityBadge severity={alert.severity} />
                    <AlertStatusBadge status={alert.status} />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground bg-background px-2 py-1 rounded-md border border-border">
                    {format(new Date(alert.timestamp), 'MMM d, HH:mm')}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {alert.title}
                </h3>
                <p className="text-muted-foreground text-sm mb-6 flex-1">
                  {alert.description}
                </p>
                
                <div className="bg-background/50 border border-border rounded-xl p-4 mb-6 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Triggered Rule</span>
                    <span className="font-mono text-foreground">{alert.ruleTriggered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer ID</span>
                    <span className="font-mono text-foreground">{alert.customerId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction ID</span>
                    <span className="font-mono text-primary cursor-pointer hover:underline">{alert.transactionId.substring(0, 16)}...</span>
                  </div>
                </div>

                <div className="flex gap-3 mt-auto pt-4 border-t border-white/5">
                  {alert.status === 'open' && (
                    <button 
                      disabled={isPending}
                      onClick={() => handleStatusChange(alert.id, 'investigating')}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all"
                    >
                      Investigate
                    </button>
                  )}
                  {(alert.status === 'open' || alert.status === 'investigating') && (
                    <>
                      <button 
                        disabled={isPending}
                        onClick={() => handleStatusChange(alert.id, 'resolved')}
                        className="flex-1 bg-success hover:bg-success/90 text-success-foreground font-semibold py-2.5 rounded-xl flex justify-center items-center gap-2 shadow-lg shadow-success/20 transition-all"
                      >
                        <Check className="w-4 h-4" /> Resolve
                      </button>
                      <button 
                        disabled={isPending}
                        onClick={() => handleStatusChange(alert.id, 'dismissed')}
                        className="flex-1 bg-secondary hover:bg-white/10 text-secondary-foreground font-semibold py-2.5 rounded-xl flex justify-center items-center gap-2 transition-all border border-transparent hover:border-white/10"
                      >
                        <X className="w-4 h-4" /> Dismiss
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </AppLayout>
  );
}

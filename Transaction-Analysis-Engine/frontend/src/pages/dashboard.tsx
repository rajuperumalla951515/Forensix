import { useGetDashboardKpis, useGetDashboardRecentAlerts } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { LoadingState, ErrorState } from "@/components/ui/loading-state";
import { ArrowUpRight, ArrowDownRight, Activity, ShieldAlert, DollarSign, Target, Briefcase, Network } from "lucide-react";
import { motion } from "framer-motion";
import { SeverityBadge, AlertStatusBadge } from "@/components/status-badges";
import { format } from "date-fns";

function MetricCard({ 
  title, 
  value, 
  delta, 
  inverse = false, 
  icon: Icon,
  delay = 0 
}: { 
  title: string; 
  value: string | number; 
  delta: number; 
  inverse?: boolean;
  icon: any;
  delay: number;
}) {
  const isPositive = delta > 0;
  const isGood = inverse ? !isPositive : isPositive;
  const trendColor = isGood ? "text-success" : "text-destructive";
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:border-primary/30 transition-all duration-300"
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-muted-foreground font-medium text-sm">{title}</h3>
        <div className="p-2 bg-white/5 rounded-lg border border-white/5 text-muted-foreground group-hover:text-primary transition-colors">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <div className="text-3xl font-display font-bold text-foreground tracking-tight">{value}</div>
        </div>
        <div className={`flex items-center gap-1 text-sm font-semibold ${trendColor} bg-white/5 px-2 py-1 rounded-md border border-white/5`}>
          <TrendIcon className="w-3.5 h-3.5" />
          <span>{Math.abs(delta)}%</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading, error: kpisError } = useGetDashboardKpis();
  const { data: alerts, isLoading: alertsLoading } = useGetDashboardRecentAlerts();

  if (kpisLoading) return <AppLayout><LoadingState message="Loading platform metrics..." /></AppLayout>;
  if (kpisError) return <AppLayout><ErrorState error={kpisError as Error} /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">Platform Overview</h1>
          <p className="text-muted-foreground">Monitor real-time fraud metrics and anomalies across the network.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 px-4 py-2 rounded-xl border border-border">
          <span className="w-2 h-2 rounded-full bg-success box-glow animate-pulse" />
          System Status: Healthy
        </div>
      </div>

      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <MetricCard 
            title="Total Transactions" 
            value={kpis.totalTransactions.toLocaleString()} 
            delta={kpis.totalTransactionsDelta} 
            icon={Activity}
            delay={0.1}
          />
          <MetricCard 
            title="Flagged Transactions" 
            value={kpis.flaggedTransactions.toLocaleString()} 
            delta={kpis.flaggedTransactionsDelta} 
            inverse 
            icon={Target}
            delay={0.2}
          />
          <MetricCard 
            title="Total Amount Flagged" 
            value={`$${(kpis.totalAmountFlagged / 1000000).toFixed(2)}M`} 
            delta={kpis.totalAmountFlaggedDelta} 
            inverse 
            icon={DollarSign}
            delay={0.3}
          />
          <MetricCard 
            title="Open Alerts" 
            value={kpis.openAlerts} 
            delta={kpis.openAlertsDelta} 
            inverse 
            icon={ShieldAlert}
            delay={0.4}
          />
          <MetricCard 
            title="Active Investigations" 
            value={kpis.activeCases} 
            delta={kpis.activeCasesDelta} 
            inverse 
            icon={Briefcase}
            delay={0.5}
          />
          <MetricCard 
            title="Current Fraud Rate" 
            value={`${kpis.fraudRate}%`} 
            delta={kpis.fraudRateDelta} 
            inverse 
            icon={Activity}
            delay={0.6}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Alerts Column */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-white/5 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <h2 className="text-xl font-display font-bold text-foreground">Critical Alerts Timeline</h2>
            <button className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors">View All</button>
          </div>
          
          <div className="flex-1 p-0 overflow-auto max-h-[400px]">
            {alertsLoading ? (
              <LoadingState />
            ) : !alerts || alerts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No recent alerts found.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {alerts.slice(0, 5).map((alert, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i }}
                    key={alert.id} 
                    className="p-5 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row gap-4 sm:items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <SeverityBadge severity={alert.severity} />
                        <h4 className="font-semibold text-foreground">{alert.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{alert.description}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground font-medium">
                        <span>Rule: <span className="text-foreground/80">{alert.ruleTriggered}</span></span>
                        <span>Time: <span className="text-foreground/80">{format(new Date(alert.timestamp), 'MMM d, HH:mm')}</span></span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <AlertStatusBadge status={alert.status} />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Network Mini-preview */}
        <div className="glass-card rounded-2xl border border-white/5 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80')] opacity-10 mix-blend-overlay bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mb-4 mx-auto box-glow">
              <Network className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-display font-bold text-foreground mb-2">Network Graph</h3>
            <p className="text-sm text-muted-foreground mb-6">Interactive visualization of suspicious fund flows and entity connections.</p>
            
            <a href="/fund-flow" className="inline-block px-6 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-105 active:scale-95">
              Launch Explorer
            </a>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

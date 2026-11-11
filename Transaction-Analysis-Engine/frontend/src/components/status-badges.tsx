import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ShieldAlert, ShieldCheck, Shield, AlertTriangle, AlertCircle, Ban, Clock, CheckCircle2 } from "lucide-react";
import type { TransactionStatus, TransactionRiskLevel, AlertSeverity, AlertStatus, FraudCaseStatus, CustomerStatus } from "@workspace/api-client-react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Transaction Risk Level
export function RiskBadge({ level }: { level: TransactionRiskLevel }) {
  const styles = {
    low: "bg-success/15 text-success border-success/30",
    medium: "bg-warning/15 text-warning border-warning/30",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    critical: "bg-destructive/15 text-destructive border-destructive/30 box-glow",
  };

  const Icons = {
    low: ShieldCheck,
    medium: Shield,
    high: AlertTriangle,
    critical: ShieldAlert,
  };
  
  const Icon = Icons[level];

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", styles[level])}>
      <Icon className="w-3.5 h-3.5" />
      <span className="capitalize">{level}</span>
    </span>
  );
}

// Transaction Status
export function TxStatusBadge({ status }: { status: TransactionStatus }) {
  const styles = {
    flagged: "bg-warning/15 text-warning border-warning/30",
    cleared: "bg-success/15 text-success border-success/30",
    blocked: "bg-destructive/15 text-destructive border-destructive/30",
    pending: "bg-muted text-muted-foreground border-border",
  };

  const Icons = {
    flagged: AlertCircle,
    cleared: CheckCircle2,
    blocked: Ban,
    pending: Clock,
  };
  
  const Icon = Icons[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", styles[status])}>
      <Icon className="w-3.5 h-3.5" />
      <span className="capitalize">{status}</span>
    </span>
  );
}

// Alert Severity
export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const styles = {
    low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    medium: "bg-warning/15 text-warning border-warning/30",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    critical: "bg-destructive/15 text-destructive border-destructive/30",
  };

  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider", styles[severity])}>
      {severity}
    </span>
  );
}

// Alert Status
export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const styles = {
    open: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    investigating: "bg-warning/15 text-warning border-warning/30",
    resolved: "bg-success/15 text-success border-success/30",
    dismissed: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize", styles[status])}>
      {status}
    </span>
  );
}

// Customer Status
export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const styles = {
    active: "bg-success/15 text-success border-success/30",
    suspended: "bg-warning/15 text-warning border-warning/30",
    blocked: "bg-destructive/15 text-destructive border-destructive/30",
    under_review: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  };

  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize", styles[status])}>
      {status.replace('_', ' ')}
    </span>
  );
}

// Case Status
export function CaseStatusBadge({ status }: { status: FraudCaseStatus }) {
  const styles = {
    open: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    investigating: "bg-warning/15 text-warning border-warning/30",
    pending_review: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    closed: "bg-success/15 text-success border-success/30",
    escalated: "bg-destructive/15 text-destructive border-destructive/30",
  };

  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize", styles[status])}>
      {status.replace('_', ' ')}
    </span>
  );
}

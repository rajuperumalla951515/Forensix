import { useState, useRef, useEffect, useCallback } from "react";
import {
  useGetTransactions,
  TransactionStatus,
  TransactionRiskLevel,
  importCsvTransactions,
  type ImportCsvResult,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { LoadingState, ErrorState } from "@/components/ui/loading-state";
import { RiskBadge, TxStatusBadge } from "@/components/status-badges";
import { format } from "date-fns";
import {
  Search, Filter, Eye, Upload, X, ShieldAlert, CheckCircle2,
  AlertTriangle, Ban, Network, ChevronRight, ChevronLeft,
  FileText, Zap, RotateCcw, TrendingUp, DollarSign, AlertOctagon,
  Info, Check, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import Papa from "papaparse";
import cytoscape from "cytoscape";
import { useQueryClient } from "@tanstack/react-query";

function cn(...i: string[]) { return twMerge(clsx(i)); }

// ─────────────────────────────────────────────────────────────────────────────
// Column Auto-Detection Engine
// ─────────────────────────────────────────────────────────────────────────────

type ColumnRole = "sender" | "receiver" | "amount" | "currency" | "description" | "country" | "channel" | "timestamp" | "ignore";

interface ColCandidate {
  original: string;
  normalized: string;
  role: ColumnRole;
  confidence: number; // 0–100
  sampleValues: string[];
}

const ROLE_PATTERNS: Record<ColumnRole, string[]> = {
  sender:      ["from","sender","source","originator","payer","debitaccount","fromaccount","from_account","fromaddr","sendingaccount","payingbank","frombank","senderaccount","senderid","fromcustomer","remitter","debitor","debitparty","fromwallet"],
  receiver:    ["to","receiver","destination","beneficiary","payee","creditaccount","toaccount","to_account","toaddr","receivingaccount","tobank","receiveraccount","receiverid","tocustomer","recipient","creditor","creditparty","towallet"],
  amount:      ["amount","value","sum","total","usd","eur","gbp","money","price","fee","balance","transfer","amt","quantity","txamount","transactionamount","transferamount","txvalue","amountusd"],
  currency:    ["currency","ccy","cur","curr","iso","coin","denominat"],
  description: ["description","desc","memo","note","narration","remarks","details","purpose","reference","info","comment","reason","label","tag"],
  country:     ["country","nation","countrycode","region","geography","jurisdiction","domicile","residence"],
  channel:     ["channel","method","type","medium","mode","paymentmethod","txtype","transactiontype","network","instrument","source"],
  timestamp:   ["date","time","timestamp","datetime","created","txdate","transactiondate","txtime","valuedate","settlementdate","processdate","postdate","effectivedate"],
  ignore:      [],
};

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scoreColumn(header: string, values: string[]): { role: ColumnRole; confidence: number } {
  const norm = normalizeKey(header);
  let best: ColumnRole = "ignore";
  let bestScore = 0;

  for (const [role, patterns] of Object.entries(ROLE_PATTERNS) as [ColumnRole, string[]][]) {
    let score = 0;
    // Exact match
    if (patterns.includes(norm)) score += 90;
    // Prefix/suffix match
    else if (patterns.some(p => norm.startsWith(p) || norm.endsWith(p) || p.startsWith(norm))) score += 60;
    // Substring match
    else if (patterns.some(p => norm.includes(p) || p.includes(norm))) score += 35;

    // Type-inference bonus for amount
    if (role === "amount") {
      const numericRatio = values.filter(v => !isNaN(parseFloat(v.replace(/[$,£€]/g, "")))).length / Math.max(1, values.length);
      if (numericRatio > 0.8) score += 30;
      // Penalty if avg value looks like a year or timestamp
      const avg = values.reduce((s, v) => s + (parseFloat(v) || 0), 0) / values.length;
      if (avg > 1900 && avg < 2100) score -= 20; // looks like year
    }
    // Type-inference bonus for timestamp
    if (role === "timestamp") {
      const dateRatio = values.filter(v => !isNaN(Date.parse(v)) && v.length > 4).length / Math.max(1, values.length);
      if (dateRatio > 0.5) score += 20;
    }
    // Type-inference bonus for currency
    if (role === "currency") {
      const isoRatio = values.filter(v => /^[A-Z]{3}$/.test(v.trim())).length / Math.max(1, values.length);
      if (isoRatio > 0.5) score += 25;
    }

    if (score > bestScore) { bestScore = score; best = role; }
  }

  return { role: best, confidence: Math.min(100, bestScore) };
}

function detectColumns(headers: string[], rows: Record<string, string>[]): ColCandidate[] {
  const sampleRows = rows.slice(0, 10);
  return headers.map(h => {
    const values = sampleRows.map(r => r[h] ?? "").filter(Boolean);
    const { role, confidence } = scoreColumn(h, values);
    return { original: h, normalized: normalizeKey(h), role, confidence, sampleValues: values.slice(0, 3) };
  });
}

function extractMapped(row: Record<string, string>, mapping: Record<ColumnRole, string>) {
  const get = (role: ColumnRole) => {
    const col = mapping[role];
    if (!col) return "";
    const val = row[col] ?? "";
    return val.trim();
  };
  const rawAmount = get("amount").replace(/[$,£€\s]/g, "");
  return {
    fromAccount:  get("sender")  || "UNKNOWN",
    toAccount:    get("receiver") || "UNKNOWN",
    amount:       parseFloat(rawAmount) || 0,
    currency:     (get("currency") || "USD").toUpperCase().slice(0, 3) || "USD",
    description:  get("description"),
    country:      get("country"),
    channel:      get("channel"),
    timestamp:    get("timestamp"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Severity config
// ─────────────────────────────────────────────────────────────────────────────

const SEV = {
  critical: { color: "text-red-400",    bg: "bg-red-950/60 border-red-800",       icon: Ban,           label: "CRITICAL" },
  high:     { color: "text-orange-400", bg: "bg-orange-950/60 border-orange-800", icon: AlertTriangle, label: "HIGH" },
  medium:   { color: "text-yellow-400", bg: "bg-yellow-950/60 border-yellow-800", icon: ShieldAlert,   label: "MEDIUM" },
  low:      { color: "text-blue-400",   bg: "bg-blue-950/60 border-blue-800",     icon: CheckCircle2,  label: "LOW" },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Cytoscape Graph
// ─────────────────────────────────────────────────────────────────────────────

function FundFlowGraph({ graphData }: { graphData: ImportCsvResult["graphData"] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selected, setSelected] = useState<{ label: string; amount: number; txCount?: number; riskLevel: string } | null>(null);

  useEffect(() => {
    if (!containerRef.current || !graphData?.nodes?.length) return;
    cyRef.current?.destroy();

    const maxAmt = Math.max(...graphData.nodes.map(n => n.totalAmount ?? n.amount ?? 0), 1);

    const elements = [
      ...graphData.nodes.map(n => {
        const amt = n.totalAmount ?? n.amount ?? 0;
        const size = 28 + Math.sqrt(amt / maxAmt) * 32;
        return { data: { id: n.id, label: n.label, type: n.type, riskLevel: n.riskLevel, amount: amt, txCount: n.txCount ?? 1, size } };
      }),
      ...graphData.edges.map(e => ({ data: { id: e.id, source: e.source, target: e.target, label: `$${Number(e.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, status: e.status, riskScore: e.riskScore ?? 0 } })),
    ];

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)", color: "#e2e8f0",
            "font-family": "Manrope, ui-sans-serif", "font-size": "10px", "font-weight": "700",
            "text-valign": "bottom", "text-margin-y": 7,
            "background-color": "#1e293b", "border-width": 2, "border-color": "#00d2ff",
            width: "data(size)", height: "data(size)",
            "text-background-color": "#0f172a", "text-background-opacity": 0.9,
            "text-background-padding": "3px", "text-background-shape": "roundrectangle",
            "overlay-padding": "6px",
          },
        },
        { selector: "node[type='merchant']",  style: { shape: "round-rectangle", "background-color": "#3b0764", "border-color": "#a855f7" } },
        { selector: "node[type='flagged']",   style: { shape: "diamond",         "background-color": "#450a0a", "border-color": "#ef4444", "border-width": 3 } },
        { selector: "node[riskLevel='critical']", style: { "border-color": "#ef4444", "background-color": "#450a0a", "border-width": 4 } },
        { selector: "node[riskLevel='high']",     style: { "border-color": "#f97316", "background-color": "#431407", "border-width": 3 } },
        { selector: "node[riskLevel='medium']",   style: { "border-color": "#eab308", "background-color": "#1c1917", "border-width": 2 } },
        { selector: "node:selected",              style: { "border-color": "#38bdf8", "border-width": 4, "background-color": "#0c4a6e" } },
        {
          selector: "edge",
          style: {
            width: 1.5, "line-color": "#334155", "target-arrow-color": "#334155",
            "target-arrow-shape": "triangle", "arrow-scale": 1.2,
            "curve-style": "bezier", label: "data(label)",
            "font-size": "9px", color: "#64748b", "text-rotation": "autorotate",
            "text-background-color": "#0f172a", "text-background-opacity": 0.8,
            "text-background-padding": "2px", "text-background-shape": "roundrectangle",
            "text-margin-y": -8,
          },
        },
        { selector: "edge[status='flagged']", style: { "line-color": "#eab308", "target-arrow-color": "#eab308", width: 2.5, "line-style": "dashed" } },
        { selector: "edge[status='blocked']", style: { "line-color": "#ef4444", "target-arrow-color": "#ef4444", width: 3.5 } },
        { selector: "edge:selected",          style: { "line-color": "#38bdf8", "target-arrow-color": "#38bdf8", width: 3 } },
      ],
      layout: { name: "cose", padding: 50, nodeRepulsion: () => 8000, idealEdgeLength: () => 140, animate: false } as any,
      wheelSensitivity: 0.2,
      minZoom: 0.2, maxZoom: 4,
    });

    cyRef.current.on("tap", "node", (e) => {
      const d = e.target.data();
      setSelected({ label: d.label, amount: d.amount, txCount: d.txCount, riskLevel: d.riskLevel });
    });
    cyRef.current.on("tap", (e) => { if (e.target === cyRef.current) setSelected(null); });

    return () => cyRef.current?.destroy();
  }, [graphData]);

  return (
    <div className="relative w-full h-[360px] bg-[#060b14] rounded-xl overflow-hidden border border-white/8">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        {[
          { label: "+", fn: () => cyRef.current?.zoom({ level: (cyRef.current?.zoom() ?? 1) * 1.3, renderedPosition: { x: 200, y: 180 } }) },
          { label: "−", fn: () => cyRef.current?.zoom({ level: (cyRef.current?.zoom() ?? 1) * 0.77, renderedPosition: { x: 200, y: 180 } }) },
          { label: "⊡", fn: () => cyRef.current?.fit(undefined, 30) },
        ].map(b => (
          <button key={b.label} onClick={b.fn}
            className="w-7 h-7 flex items-center justify-center bg-[#0f172a]/90 border border-white/10 rounded-lg text-foreground/70 hover:text-primary hover:border-primary/40 transition-colors text-sm font-bold shadow-lg">
            {b.label}
          </button>
        ))}
      </div>

      {/* Node tooltip */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-3 left-3 z-10 bg-card/95 backdrop-blur border border-white/10 rounded-xl p-3 text-xs shadow-xl max-w-[200px]">
            <p className="font-bold text-foreground truncate mb-1">{selected.label}</p>
            <p className="text-muted-foreground">Total: <span className="text-foreground font-semibold">${selected.amount.toLocaleString()}</span></p>
            {selected.txCount && <p className="text-muted-foreground">Transactions: <span className="text-foreground font-semibold">{selected.txCount}</span></p>}
            <div className={cn("mt-1.5 text-[10px] font-bold uppercase tracking-wider",
              selected.riskLevel === "critical" ? "text-red-400" :
              selected.riskLevel === "high" ? "text-orange-400" :
              selected.riskLevel === "medium" ? "text-yellow-400" : "text-green-400")}>
              {selected.riskLevel} risk
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-10 bg-[#0f172a]/90 backdrop-blur border border-white/8 rounded-lg p-2.5 text-[10px] space-y-1">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full border border-[#00d2ff] bg-[#1e293b]" /><span className="text-muted-foreground">Account</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-[2.5px] rounded-[1px] border border-[#a855f7] bg-[#3b0764]" /><span className="text-muted-foreground">Merchant</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rotate-45 border-2 border-[#ef4444] bg-[#450a0a]" /><span className="text-muted-foreground">Flagged</span></div>
        <div className="h-px bg-white/5 my-0.5" />
        <div className="flex items-center gap-1.5"><div className="w-3 border-t border-dashed border-[#eab308]" /><span className="text-muted-foreground">Flagged flow</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 border-t-2 border-[#ef4444]" /><span className="text-muted-foreground">Blocked</span></div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Column Mapping Dialog
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_ROLES: ColumnRole[] = ["sender", "receiver", "amount"];
const OPTIONAL_ROLES: ColumnRole[] = ["currency", "description", "country", "channel", "timestamp"];
const ROLE_META: Record<ColumnRole, { label: string; color: string; required?: boolean }> = {
  sender:      { label: "Sender / From",   color: "text-blue-400",   required: true },
  receiver:    { label: "Receiver / To",   color: "text-purple-400", required: true },
  amount:      { label: "Amount",          color: "text-green-400",  required: true },
  currency:    { label: "Currency",        color: "text-cyan-400" },
  description: { label: "Description",     color: "text-slate-300" },
  country:     { label: "Country",         color: "text-orange-300" },
  channel:     { label: "Channel",         color: "text-pink-300" },
  timestamp:   { label: "Date / Time",     color: "text-teal-300" },
  ignore:      { label: "Ignore",          color: "text-muted-foreground" },
};

interface MappingDialogProps {
  headers: string[];
  candidates: ColCandidate[];
  previewRows: Record<string, string>[];
  onConfirm: (mapping: Record<ColumnRole, string>) => void;
  onCancel: () => void;
}

function MappingDialog({ headers, candidates, previewRows, onConfirm, onCancel }: MappingDialogProps) {
  const initMapping = () => {
    const m: Partial<Record<ColumnRole, string>> = {};
    for (const c of candidates) {
      if (c.role !== "ignore" && c.confidence >= 30 && !m[c.role]) {
        m[c.role] = c.original;
      }
    }
    return m as Record<ColumnRole, string>;
  };

  const [mapping, setMapping] = useState<Record<ColumnRole, string>>(initMapping);

  const canImport = REQUIRED_ROLES.every(r => mapping[r]);
  const missingRequired = REQUIRED_ROLES.filter(r => !mapping[r]);

  const setField = (role: ColumnRole, col: string) => {
    setMapping(prev => {
      const next = { ...prev };
      // Remove this col from other roles
      for (const r of Object.keys(next) as ColumnRole[]) {
        if (next[r] === col && r !== role) delete next[r];
      }
      if (col) next[role] = col;
      else delete next[role];
      return next;
    });
  };

  const confidence = (col: string) => candidates.find(c => c.original === col)?.confidence ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Column Mapping</h3>
              <p className="text-xs text-muted-foreground">Auto-detected from your CSV · Adjust if needed</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scroll">
          {/* Auto-detection summary */}
          <div className="flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-xl p-3 text-xs text-primary/90">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Detected <strong>{headers.length}</strong> columns. Aegis auto-matched columns using semantic analysis — verify the mappings below before importing.</span>
          </div>

          {/* Required fields */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Required Fields</p>
            <div className="space-y-2">
              {REQUIRED_ROLES.map(role => (
                <div key={role} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-colors",
                  mapping[role] ? "bg-white/[0.02] border-white/8" : "bg-red-950/20 border-red-900/50")}>
                  <div className={cn("w-32 shrink-0 text-xs font-bold", ROLE_META[role].color)}>
                    {ROLE_META[role].label} <span className="text-destructive">*</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <select value={mapping[role] ?? ""} onChange={e => setField(role, e.target.value)}
                    className="flex-1 bg-background/70 border border-border focus:border-primary/50 rounded-lg py-1.5 px-3 text-sm text-foreground outline-none cursor-pointer">
                    <option value="">— not mapped —</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}{confidence(h) >= 60 ? " ✓" : ""}</option>
                    ))}
                  </select>
                  {mapping[role] && (
                    <div className="flex items-center gap-1 text-[10px] shrink-0">
                      <div className="w-12 h-1.5 bg-background rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${confidence(mapping[role]) ?? 0}%` }} />
                      </div>
                      <span className="text-muted-foreground">{confidence(mapping[role])}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Optional fields */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Optional Fields</p>
            <div className="space-y-2">
              {OPTIONAL_ROLES.map(role => (
                <div key={role} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.015]">
                  <div className={cn("w-32 shrink-0 text-xs font-semibold", ROLE_META[role].color)}>
                    {ROLE_META[role].label}
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                  <select value={mapping[role] ?? ""} onChange={e => setField(role, e.target.value)}
                    className="flex-1 bg-background/70 border border-border focus:border-primary/50 rounded-lg py-1.5 px-3 text-sm text-foreground outline-none cursor-pointer">
                    <option value="">— not mapped —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Data preview */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Data Preview (first 3 rows)</p>
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-white/[0.04]">
                  <tr>
                    {headers.map(h => (
                      <th key={h} className={cn("px-3 py-2 text-left font-bold",
                        Object.values(mapping).includes(h) ? "text-primary" : "text-muted-foreground/50")}>
                        {h}
                        {Object.entries(mapping).find(([, v]) => v === h) && (
                          <span className="ml-1 text-[9px] text-primary/70 font-normal">
                            ({ROLE_META[Object.entries(mapping).find(([, v]) => v === h)![0] as ColumnRole]?.label})
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {previewRows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      {headers.map(h => (
                        <td key={h} className={cn("px-3 py-2",
                          Object.values(mapping).includes(h) ? "text-foreground/90" : "text-muted-foreground/40")}>
                          {row[h] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 flex items-center justify-between bg-white/[0.01]">
          <div className="text-xs text-muted-foreground">
            {missingRequired.length > 0 ? (
              <span className="text-destructive">Missing required: {missingRequired.map(r => ROLE_META[r].label).join(", ")}</span>
            ) : (
              <span className="text-green-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> All required fields mapped</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all text-sm">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={() => onConfirm(mapping)} disabled={!canImport}
              className={cn("flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all",
                canImport ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                          : "bg-white/5 text-muted-foreground cursor-not-allowed")}>
              Import <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Results Panel
// ─────────────────────────────────────────────────────────────────────────────

function ResultsPanel({ result, onClose }: { result: ImportCsvResult; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"graph" | "alerts" | "table">("graph");
  const s = (result as any).summary ?? {
    total: result.imported,
    blocked: result.transactions?.filter((t: any) => t.status === "blocked").length ?? 0,
    flagged: result.transactions?.filter((t: any) => t.status === "flagged").length ?? 0,
    cleared: result.transactions?.filter((t: any) => t.status === "cleared").length ?? 0,
    totalValue: result.transactions?.reduce((a: number, t: any) => a + t.amount, 0) ?? 0,
    avgRiskScore: result.transactions?.reduce((a: number, t: any) => a + t.riskScore, 0) / Math.max(1, result.transactions?.length ?? 1),
  };

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
      className="glass-card rounded-2xl border border-white/8 overflow-hidden">

      {/* Header */}
      <div className="p-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Import Complete</h3>
            <p className="text-xs text-muted-foreground">
              {result.imported} transaction{result.imported !== 1 ? "s" : ""} ·&nbsp;
              {result.alerts.length} alert{result.alerts.length !== 1 ? "s" : ""} ·&nbsp;
              {result.graphData.nodes.length} nodes in graph
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-white/5 border-b border-white/5">
        {[
          { label: "Imported",     value: s.total,                     color: "text-primary",      icon: FileText },
          { label: "Blocked",      value: s.blocked,                   color: "text-red-400",      icon: Ban },
          { label: "Flagged",      value: s.flagged,                   color: "text-yellow-400",   icon: AlertOctagon },
          { label: "Cleared",      value: s.cleared,                   color: "text-green-400",    icon: CheckCircle2 },
          { label: "Total Value",  value: `$${(s.totalValue/1000).toFixed(1)}K`, color: "text-cyan-400", icon: DollarSign },
          { label: "Avg Risk",     value: `${s.avgRiskScore?.toFixed(0) ?? "—"}/100`, color: "text-orange-400", icon: TrendingUp },
        ].map(k => (
          <div key={k.label} className="flex items-center gap-2 bg-card/50 px-4 py-3">
            <k.icon className={cn("w-4 h-4 shrink-0", k.color)} />
            <div>
              <p className={cn("text-lg font-bold leading-none", k.color)}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-white/[0.01]">
        {([
          { id: "graph",  label: "Fund Flow Graph", icon: Network },
          { id: "alerts", label: `Alerts (${result.alerts.length})`, icon: ShieldAlert },
          { id: "table",  label: "Transactions", icon: FileText },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn("flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px",
              activeTab === t.id
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-white/[0.02]")}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          {activeTab === "graph" && (
            <motion.div key="graph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <FundFlowGraph graphData={result.graphData} />
            </motion.div>
          )}

          {activeTab === "alerts" && (
            <motion.div key="alerts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {result.alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                  <p className="text-green-400 font-medium">All transactions cleared — no fraud detected</p>
                </div>
              ) : (
                result.alerts.map((a: any, i: number) => {
                  const cfg = SEV[a.severity as keyof typeof SEV] ?? SEV.low;
                  const Icon = cfg.icon;
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      className={cn("rounded-xl border p-4 flex gap-3", cfg.bg)}>
                      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", cfg.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("text-[10px] font-bold tracking-widest uppercase", cfg.color)}>{cfg.label}</span>
                          <span className="text-[10px] text-muted-foreground">Score: <strong className={cfg.color}>{a.riskScore?.toFixed(0)}</strong>/100</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{a.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                        {(a.riskFlags as string[] | undefined)?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(a.riskFlags as string[]).slice(0, 3).map((f: string, fi: number) => (
                              <span key={fi} className="text-[10px] bg-white/5 border border-white/8 rounded-full px-2 py-0.5 text-muted-foreground">{f}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-foreground">
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: a.currency || "USD" }).format(a.amount)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {activeTab === "table" && (
            <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="overflow-x-auto max-h-[380px] rounded-xl border border-white/5">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-white/[0.04] text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">From</th>
                    <th className="px-4 py-3 text-left font-bold">To</th>
                    <th className="px-4 py-3 text-left font-bold">Amount</th>
                    <th className="px-4 py-3 text-left font-bold">Risk</th>
                    <th className="px-4 py-3 text-left font-bold">Score</th>
                    <th className="px-4 py-3 text-left font-bold">Status</th>
                    <th className="px-4 py-3 text-left font-bold">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {result.transactions?.map((tx: any, i: number) => (
                    <motion.tr key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 font-mono text-foreground/80">{tx.fromAccount.slice(0, 16)}</td>
                      <td className="px-4 py-2.5 font-mono text-foreground/80">{tx.toAccount.slice(0, 16)}</td>
                      <td className="px-4 py-2.5 font-semibold">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: tx.currency || "USD" }).format(tx.amount)}
                      </td>
                      <td className="px-4 py-2.5"><RiskBadge level={tx.riskLevel} /></td>
                      <td className="px-4 py-2.5">
                        <span className={cn("font-bold",
                          tx.riskScore >= 80 ? "text-red-400" : tx.riskScore >= 60 ? "text-orange-400" :
                          tx.riskScore >= 35 ? "text-yellow-400" : "text-green-400")}>
                          {tx.riskScore.toFixed(0)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5"><TxStatusBadge status={tx.status} /></td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[200px]">
                        {(tx.riskFlags as string[] | undefined)?.[0] ?? "—"}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Upload Button + Flow Controller
// ─────────────────────────────────────────────────────────────────────────────

type UploadStage = "idle" | "mapping" | "importing" | "done" | "error";

interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  candidates: ColCandidate[];
  fileName: string;
}

function CsvUploadFlow({
  onResult, onError,
}: {
  onResult: (r: ImportCsvResult) => void;
  onError: (msg: string) => void;
}) {
  const [stage, setStage] = useState<UploadStage>("idle");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!res.data.length) { onError("CSV file is empty or has no valid rows."); return; }
        const headers = res.meta.fields ?? Object.keys(res.data[0] ?? {});
        const candidates = detectColumns(headers, res.data);
        setParsed({ headers, rows: res.data, candidates, fileName: file.name });
        setStage("mapping");
      },
      error: (err) => onError(`Parse error: ${err.message}`),
    });
  }, [onError]);

  const handleConfirm = async (mapping: Record<ColumnRole, string>) => {
    if (!parsed) return;
    setStage("importing");
    try {
      const transactions = parsed.rows
        .map(row => extractMapped(row, mapping))
        .filter(r => r.fromAccount !== "UNKNOWN" && r.toAccount !== "UNKNOWN" && r.amount > 0);

      if (!transactions.length) throw new Error("No valid transactions found after mapping. Check that amount values are numeric.");

      const result = await importCsvTransactions({ transactions });
      onResult(result);
      setStage("done");
    } catch (err: any) {
      setStage("error");
      onError(err?.message ?? "Import failed.");
    }
    setParsed(null);
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

      <button onClick={() => fileRef.current?.click()} disabled={stage === "importing"}
        className={cn("flex items-center gap-2 px-4 py-2 rounded-lg border font-semibold text-sm transition-all select-none",
          stage === "importing"
            ? "bg-primary/10 border-primary/20 text-primary/50 cursor-not-allowed"
            : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 active:scale-95")}>
        {stage === "importing"
          ? <><RotateCcw className="w-4 h-4 animate-spin" />Processing…</>
          : <><Upload className="w-4 h-4" />Upload CSV</>}
      </button>

      <AnimatePresence>
        {stage === "mapping" && parsed && (
          <MappingDialog
            headers={parsed.headers}
            candidates={parsed.candidates}
            previewRows={parsed.rows}
            onConfirm={handleConfirm}
            onCancel={() => { setStage("idle"); setParsed(null); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [page, setPage]             = useState(1);
  const [status, setStatus]         = useState<TransactionStatus | "all">("all");
  const [riskLevel, setRiskLvl]     = useState<TransactionRiskLevel | "all">("all");
  const [search, setSearch]         = useState("");
  const [csvResult, setCsvResult]   = useState<ImportCsvResult | null>(null);
  const [csvError, setCsvError]     = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useGetTransactions({
    page, limit: 15,
    ...(status !== "all" && { status }),
    ...(riskLevel !== "all" && { riskLevel: riskLevel as TransactionRiskLevel }),
    ...(search && { search }),
  });

  const handleCsvResult = (r: ImportCsvResult) => {
    setCsvResult(r);
    setCsvError(null);
    queryClient.invalidateQueries({ queryKey: ["/transactions"] });
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Transactions Directory</h1>
        <p className="text-muted-foreground">Review all transactions · Upload any CSV format for instant risk analysis.</p>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {csvError && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-4 flex items-center gap-3 bg-red-950/50 border border-red-800/60 rounded-xl px-4 py-3 text-sm text-red-300">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span className="flex-1">{csvError}</span>
            <button onClick={() => setCsvError(null)}><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table card */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden mb-6">
        {/* Toolbar */}
        <div className="p-4 border-b border-white/5 bg-white/[0.015] flex flex-col md:flex-row gap-3 justify-between items-center">
          <div className="flex-1 w-full relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input type="text" placeholder="Search by ID, account, or description…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full max-w-sm bg-background/50 border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/30 rounded-lg py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all" />
          </div>

          <div className="flex gap-2 w-full md:w-auto items-center flex-wrap">
            <div className="relative">
              <select value={status} onChange={e => setStatus(e.target.value as TransactionStatus | "all")}
                className="appearance-none bg-background/60 border border-border focus:border-primary/50 rounded-lg py-2 pl-3 pr-9 text-sm text-foreground outline-none cursor-pointer">
                <option value="all">All Statuses</option>
                {Object.values(TransactionStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <div className="relative">
              <select value={riskLevel} onChange={e => setRiskLvl(e.target.value as TransactionRiskLevel | "all")}
                className="appearance-none bg-background/60 border border-border focus:border-primary/50 rounded-lg py-2 pl-3 pr-9 text-sm text-foreground outline-none cursor-pointer">
                <option value="all">All Risks</option>
                {Object.values(TransactionRiskLevel).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            <CsvUploadFlow onResult={handleCsvResult} onError={setCsvError} />
          </div>
        </div>

        {/* CSV hint bar */}
        <div className="px-4 py-2 border-b border-white/5 bg-primary/[0.04] flex items-center gap-2 text-xs text-primary/70">
          <Zap className="w-3.5 h-3.5 shrink-0" />
          <span>Smart CSV import: accepts <strong>any column format</strong> — auto-detects sender, receiver, amount with confidence scoring. Drag &amp; drop or click Upload CSV.</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isLoading ? <LoadingState />
           : error ? <ErrorState error={error as Error} />
           : !data?.data.length ? (
            <div className="p-12 text-center flex flex-col items-center text-muted-foreground">
              <Search className="w-12 h-12 mb-4 opacity-15" />
              <p>No transactions found.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white/[0.02] border-b border-white/5 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">Transaction ID</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Risk Level</th>
                  <th className="px-6 py-4">Score</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.data.map((tx, i) => (
                  <motion.tr key={tx.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-foreground/70">{tx.txHash.slice(0, 18)}…</td>
                    <td className="px-6 py-4 font-semibold">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: tx.currency }).format(tx.amount)}
                    </td>
                    <td className="px-6 py-4"><TxStatusBadge status={tx.status} /></td>
                    <td className="px-6 py-4"><RiskBadge level={tx.riskLevel} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-background/50 rounded-full h-1.5 overflow-hidden border border-border">
                          <div className={cn("h-full rounded-full",
                            tx.riskScore > 75 ? "bg-red-500" : tx.riskScore > 50 ? "bg-orange-500" :
                            tx.riskScore > 25 ? "bg-yellow-500" : "bg-green-500")}
                            style={{ width: `${tx.riskScore}%` }} />
                        </div>
                        <span className={cn("text-xs font-bold w-8",
                          tx.riskScore > 75 ? "text-red-400" : tx.riskScore > 50 ? "text-orange-400" :
                          tx.riskScore > 25 ? "text-yellow-400" : "text-green-400")}>
                          {tx.riskScore.toFixed(0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {format(new Date(tx.timestamp), "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors inline-flex">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between bg-white/[0.01]">
            <span className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{(page - 1) * 15 + 1}</span>–<span className="font-semibold text-foreground">{Math.min(page * 15, data.total)}</span> of <span className="font-semibold text-foreground">{data.total}</span>
            </span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground hover:bg-white/5 disabled:opacity-40 transition-colors text-xs font-medium">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button disabled={page * 15 >= data.total} onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-background border border-border text-foreground hover:bg-white/5 disabled:opacity-40 transition-colors text-xs font-medium">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results panel */}
      <AnimatePresence>
        {csvResult && <ResultsPanel result={csvResult} onClose={() => setCsvResult(null)} />}
      </AnimatePresence>
    </AppLayout>
  );
}

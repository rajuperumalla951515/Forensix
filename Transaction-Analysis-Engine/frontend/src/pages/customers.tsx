import { useState } from "react";
import { useGetCustomers, CustomerRiskLevel } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { LoadingState, ErrorState } from "@/components/ui/loading-state";
import { RiskBadge, CustomerStatusBadge } from "@/components/status-badges";
import { format } from "date-fns";
import { Search, Filter, Users } from "lucide-react";
import { motion } from "framer-motion";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [riskLevel, setRiskLevel] = useState<CustomerRiskLevel | "all">("all");

  const { data, isLoading, error } = useGetCustomers({
    ...(search && { search }),
    ...(riskLevel !== "all" && { riskLevel }),
  });

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Customer Risk Profiles</h1>
        <p className="text-muted-foreground">Monitor entity-level risk and account statuses.</p>
      </div>

      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden flex flex-col mb-8">
        {/* Filters */}
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex-1 w-full relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search by Name, Email, or Account..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md bg-background/50 border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-lg py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-all outline-none"
            />
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative w-full">
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value as CustomerRiskLevel | "all")}
                className="appearance-none bg-background/50 border border-border focus:border-primary/50 rounded-lg py-2 pl-4 pr-10 text-sm text-foreground outline-none cursor-pointer w-full"
              >
                <option value="all">All Risks</option>
                {Object.values(CustomerRiskLevel).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error as Error} />
          ) : !data || data.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <Users className="w-12 h-12 mb-4 opacity-20" />
              <p>No customers found matching your criteria.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white/[0.02] border-b border-white/5 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Risk Profile</th>
                  <th className="px-6 py-4">Flagged / Total Tx</th>
                  <th className="px-6 py-4">Country</th>
                  <th className="px-6 py-4">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((c, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={c.id} 
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <CustomerStatusBadge status={c.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <RiskBadge level={c.riskLevel} />
                        <span className="text-xs font-mono text-muted-foreground">Score: {c.riskScore}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={c.flaggedTransactions > 0 ? "text-destructive font-bold" : "text-foreground"}>
                          {c.flaggedTransactions}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-foreground">{c.totalTransactions}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {c.country}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {format(new Date(c.joinedAt), 'MMM d, yyyy')}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

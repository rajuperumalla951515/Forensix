import { useGetCases } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { LoadingState, ErrorState } from "@/components/ui/loading-state";
import { CaseStatusBadge } from "@/components/status-badges";
import { format } from "date-fns";
import { FolderOpen } from "lucide-react";
import { motion } from "framer-motion";

export default function CasesPage() {
  const { data, isLoading, error } = useGetCases();

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Investigation Cases</h1>
        <p className="text-muted-foreground">Track and manage complex fraud investigation workflows.</p>
      </div>

      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error as Error} />
          ) : !data || data.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <FolderOpen className="w-12 h-12 mb-4 opacity-20" />
              <p>No cases found.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white/[0.02] border-b border-white/5 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-6 py-4">Case Number</th>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Exposure</th>
                  <th className="px-6 py-4">Assignee</th>
                  <th className="px-6 py-4">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((c, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={c.id} 
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-mono font-semibold text-primary group-hover:underline">
                      {c.caseNumber}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {c.title}
                    </td>
                    <td className="px-6 py-4">
                      <CaseStatusBadge status={c.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-foreground">{c.customerName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{c.customerId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-foreground">
                      ${(c.totalAmount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {c.assignee}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {format(new Date(c.updatedAt), 'MMM d, yyyy')}
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

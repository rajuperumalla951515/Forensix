import { useGetReportsSummary } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { LoadingState, ErrorState } from "@/components/ui/loading-state";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { motion } from "framer-motion";

const COLORS = ['hsl(180, 100%, 45%)', 'hsl(210, 100%, 56%)', 'hsl(260, 100%, 65%)', 'hsl(320, 100%, 65%)', 'hsl(38, 92%, 55%)'];

export default function ReportsPage() {
  const { data, isLoading, error } = useGetReportsSummary();

  if (isLoading) return <AppLayout><LoadingState message="Compiling analytics..." /></AppLayout>;
  if (error) return <AppLayout><ErrorState error={error as Error} /></AppLayout>;
  if (!data) return <AppLayout><div /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Analytics & Reports</h1>
        <p className="text-muted-foreground">Historical trends and categorised fraud analysis.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Main Trend Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 glass-card rounded-2xl p-6 border border-white/5"
        >
          <h2 className="text-xl font-display font-bold text-foreground mb-6">Monthly Fraud Trend</h2>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyFraudTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFlagged" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(348, 83%, 55%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(348, 83%, 55%)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCleared" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(180, 100%, 45%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(180, 100%, 45%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{fill: 'hsl(var(--muted-foreground))'}} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{fill: 'hsl(var(--muted-foreground))'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--foreground))' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Legend />
                <Area type="monotone" dataKey="cleared" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorCleared)" />
                <Area type="monotone" dataKey="flagged" stroke="hsl(var(--destructive))" strokeWidth={2} fillOpacity={1} fill="url(#colorFlagged)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Categories Pie Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col"
        >
          <h2 className="text-xl font-display font-bold text-foreground mb-2">Fraud by Category</h2>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.fraudByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="category"
                  stroke="none"
                >
                  {data.fraudByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--foreground))' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl border border-white/5 overflow-hidden"
        >
          <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-display font-bold text-foreground">Top Risky Jurisdictions</h2>
          </div>
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/[0.02] border-b border-white/5 text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Country</th>
                <th className="px-6 py-4">Incident Count</th>
                <th className="px-6 py-4 text-right">Exposure Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.topRiskyCountries.map((c, i) => (
                <tr key={c.country} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-semibold text-foreground flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs">
                      {c.country.substring(0, 2).toUpperCase()}
                    </div>
                    {c.country}
                  </td>
                  <td className="px-6 py-4 text-orange-400 font-mono">{c.count}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">
                    ${(c.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </AppLayout>
  );
}

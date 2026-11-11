import { useEffect, useRef, useState } from "react";
import { useGetFundFlowGraph } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { LoadingState, ErrorState } from "@/components/ui/loading-state";
import cytoscape from "cytoscape";
import { Search, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { motion } from "framer-motion";

export default function FundFlowPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data, isLoading, error } = useGetFundFlowGraph({
    ...(searchQuery && { transactionId: searchQuery }) // Using txId as main filter for demo
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(transactionId);
  };

  useEffect(() => {
    if (!containerRef.current || !data || data.nodes.length === 0) return;

    // Destroy existing instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const elements = [
      ...data.nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label,
          type: node.type,
          riskLevel: node.riskLevel,
          amount: node.amount,
        }
      })),
      ...data.edges.map(edge => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: `$${edge.amount}`,
          status: edge.status
        }
      }))
    ];

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#f8fafc',
            'font-family': 'Manrope, sans-serif',
            'font-size': '12px',
            'font-weight': 'bold',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'background-color': '#1e293b',
            'border-width': 2,
            'border-color': '#00d2ff',
            'width': 40,
            'height': 40,
            'text-background-color': '#0f172a',
            'text-background-opacity': 0.8,
            'text-background-padding': 4,
            'text-background-shape': 'roundrectangle'
          }
        },
        {
          selector: 'node[type="bank"]',
          style: {
            'shape': 'diamond',
            'background-color': '#334155',
            'border-color': '#94a3b8',
            'width': 50,
            'height': 50,
          }
        },
        {
          selector: 'node[type="merchant"]',
          style: {
            'shape': 'round-rectangle',
            'background-color': '#4c1d95',
            'border-color': '#8b5cf6',
          }
        },
        {
          selector: 'node[riskLevel="critical"]',
          style: {
            'border-color': '#fb3b5a',
            'background-color': '#4c0519',
            'border-width': 4,
            'shadow-blur': 20,
            'shadow-color': '#fb3b5a',
            'shadow-opacity': 0.5
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#334155',
            'target-arrow-color': '#334155',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'color': '#94a3b8',
            'text-rotation': 'autorotate',
            'text-margin-y': -10
          }
        },
        {
          selector: 'edge[status="flagged"]',
          style: {
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'width': 3,
            'line-style': 'dashed'
          }
        },
        {
          selector: 'edge[status="blocked"]',
          style: {
            'line-color': '#fb3b5a',
            'target-arrow-color': '#fb3b5a',
            'width': 4
          }
        }
      ],
      layout: {
        name: 'cose',
        padding: 50,
        nodeRepulsion: () => 4000,
        idealEdgeLength: () => 100,
      },
      wheelSensitivity: 0.2
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [data]);

  const zoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const zoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const fit = () => cyRef.current?.fit();

  return (
    <AppLayout>
      <div className="h-full flex flex-col min-h-[calc(100vh-8rem)]">
        <div className="mb-4 flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">Fund Flow Explorer</h1>
            <p className="text-muted-foreground">Visualize money movement and trace illicit networks interactively.</p>
          </div>
          
          <form onSubmit={handleSearch} className="relative group w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Enter Transaction or Entity ID"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full bg-card/80 backdrop-blur border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-lg py-2.5 pl-9 pr-24 text-sm text-foreground placeholder:text-muted-foreground transition-all outline-none"
            />
            <button type="submit" className="absolute right-1 top-1.5 bottom-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-3 rounded-md text-xs font-semibold transition-colors">
              Trace
            </button>
          </form>
        </div>

        <div className="flex-1 glass-card rounded-2xl border border-white/5 relative overflow-hidden flex flex-col min-h-[500px]">
          {isLoading ? (
            <LoadingState message="Generating network graph..." />
          ) : error ? (
            <ErrorState error={error as Error} />
          ) : (
            <>
              {/* Controls Overlay */}
              <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <button onClick={zoomIn} className="p-2 bg-card/80 backdrop-blur border border-white/10 rounded-lg text-foreground hover:text-primary hover:border-primary/50 transition-colors shadow-lg">
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button onClick={zoomOut} className="p-2 bg-card/80 backdrop-blur border border-white/10 rounded-lg text-foreground hover:text-primary hover:border-primary/50 transition-colors shadow-lg">
                  <ZoomOut className="w-5 h-5" />
                </button>
                <button onClick={fit} className="p-2 bg-card/80 backdrop-blur border border-white/10 rounded-lg text-foreground hover:text-primary hover:border-primary/50 transition-colors shadow-lg">
                  <Maximize className="w-5 h-5" />
                </button>
              </div>

              {/* Legend Overlay */}
              <div className="absolute bottom-4 left-4 z-10 bg-card/90 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-2xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Legend</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border border-[#00d2ff] bg-[#1e293b]" />
                    <span className="text-foreground">Account</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rotate-45 border border-[#94a3b8] bg-[#334155]" />
                    <span className="text-foreground">Bank</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-[2px] border border-[#8b5cf6] bg-[#4c1d95]" />
                    <span className="text-foreground">Merchant</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-[#fb3b5a] bg-[#4c0519] shadow-[0_0_8px_rgba(251,59,90,0.5)]" />
                    <span className="text-foreground">Critical Risk</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2 mt-2 pt-2 border-t border-white/5">
                    <div className="w-6 h-0.5 bg-[#f59e0b] border-t border-dashed border-[#f59e0b]" />
                    <span className="text-foreground">Flagged Transfer</span>
                  </div>
                </div>
              </div>

              {/* Cytoscape Container */}
              <div ref={containerRef} className="absolute inset-0 w-full h-full bg-[#0a0f1c]" />
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

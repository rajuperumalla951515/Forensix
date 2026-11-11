import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export function LoadingState({ message = "Loading data..." }: { message?: string }) {
  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center text-muted-foreground space-y-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      >
        <Loader2 className="w-8 h-8 text-primary" />
      </motion.div>
      <p className="font-medium animate-pulse">{message}</p>
    </div>
  );
}

export function ErrorState({ error, retry }: { error?: Error | null; retry?: () => void }) {
  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center text-destructive space-y-4">
      <div className="p-4 bg-destructive/10 rounded-full border border-destructive/20">
        <Loader2 className="w-8 h-8" />
      </div>
      <div className="text-center">
        <h3 className="font-display font-semibold text-lg text-foreground">Something went wrong</h3>
        <p className="text-muted-foreground mt-1 max-w-sm">
          {error?.message || "Failed to load the requested data. Please try again."}
        </p>
      </div>
      {retry && (
        <button
          onClick={retry}
          className="px-6 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors font-medium"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Eye, EyeOff, AlertCircle, Lock, Mail,
  LogIn, UserPlus, User, Crown, ChevronRight,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth, type UserRole } from "@/context/auth";

function cn(...i: string[]) { return twMerge(clsx(i)); }

type Tab = "login" | "signup";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login, signup } = useAuth();

  const [tab, setTab]           = useState<Tab>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [role, setRole]         = useState<UserRole>("investigator");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const reset = (t: Tab) => { setTab(t); setError(""); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        if (name.trim().length < 2) throw new Error("Full name must be at least 2 characters.");
        if (password.length < 6)   throw new Error("Password must be at least 6 characters.");
        await signup({ email, password, name: name.trim(), role });
      }
      navigate("/");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-primary/8 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/6 blur-[120px] pointer-events-none" />
      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.4) 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

      <motion.div initial={{ opacity: 0, y: 32, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="relative z-10 w-full max-w-md">

        <div className="bg-card/85 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl shadow-black/40 overflow-hidden">
          {/* Accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-transparent" />

          <div className="p-8">
            {/* Logo */}
            <div className="flex flex-col items-center mb-7">
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.5, ease: "backOut" }}
                className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                <ShieldCheck className="w-8 h-8 text-primary" />
              </motion.div>
              <h1 className="text-3xl font-display font-bold text-foreground tracking-wide">
                Aegis<span className="text-primary">.</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">Banking Fraud Detection Platform</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-background/50 rounded-xl p-1 mb-6 border border-white/5">
              {(["login", "signup"] as Tab[]).map((t) => (
                <button key={t} onClick={() => reset(t)}
                  className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
                    tab === t ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground")}>
                  {t === "login" ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {t === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            {/* Form */}
            <motion.form key={tab} initial={{ opacity: 0, x: tab === "login" ? -20 : 20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }} onSubmit={handleSubmit} className="space-y-4">

              {/* Name field (signup only) */}
              <AnimatePresence>
                {tab === "signup" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</label>
                    <div className="relative group">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name" autoComplete="name"
                        className="w-full bg-background/60 border border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/20 rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com" autoComplete="email"
                    className={cn("w-full bg-background/60 border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all",
                      error ? "border-destructive/60 focus:border-destructive focus:ring-1 focus:ring-destructive/30"
                        : "border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/20")} />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={tab === "signup" ? "Min 6 characters" : "••••••••"} autoComplete={tab === "login" ? "current-password" : "new-password"}
                    className={cn("w-full bg-background/60 border rounded-xl py-3 pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all",
                      error ? "border-destructive/60 focus:border-destructive focus:ring-1 focus:ring-destructive/30"
                        : "border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/20")} />
                  <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role selector (signup only) */}
              <AnimatePresence>
                {tab === "signup" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: "investigator", label: "Investigator", desc: "View & investigate", icon: User },
                        { value: "admin", label: "Admin", desc: "Full access + users", icon: Crown },
                      ] as const).map(({ value, label, desc, icon: Icon }) => (
                        <button key={value} type="button" onClick={() => setRole(value)}
                          className={cn("flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all",
                            role === value
                              ? value === "admin"
                                ? "bg-amber-400/10 border-amber-400/40 text-amber-300"
                                : "bg-primary/10 border-primary/40 text-primary"
                              : "bg-background/40 border-border hover:border-white/20 text-muted-foreground hover:text-foreground")}>
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                          </div>
                          <span className="text-[11px] opacity-70">{desc}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2.5 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button type="submit" disabled={loading}
                className={cn("w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm text-primary-foreground transition-all duration-200 shadow-lg",
                  loading ? "bg-primary/60 cursor-not-allowed shadow-none"
                    : "bg-primary hover:bg-primary/90 shadow-primary/30 active:scale-[0.98]")}>
                {loading ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>{tab === "login" ? "Authenticating…" : "Creating Account…"}</>
                ) : tab === "login" ? (
                  <><LogIn className="w-4 h-4" />Sign In to Aegis</>
                ) : (
                  <><UserPlus className="w-4 h-4" />Create Account<ChevronRight className="w-4 h-4 ml-auto" /></>
                )}
              </button>
            </motion.form>

            {/* Demo credentials (login tab only) */}
            <AnimatePresence>
              {tab === "login" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-5 rounded-xl border border-white/8 bg-white/[0.025] p-4 text-xs space-y-2">
                  <p className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Demo Accounts</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="text-muted-foreground w-12 shrink-0">Admin</span>
                      <span className="font-mono text-foreground/70 truncate">tirumanimukesh@gmail.com / Friends@</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-primary shrink-0" />
                      <span className="text-muted-foreground w-12 shrink-0">Investigator</span>
                      <span className="font-mono text-foreground/70 truncate">analyst@aegis.com / Analyst@123</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/40 mt-4">
          © 2026 Aegis Fraud Detection Platform · Secured Connection
        </p>
      </motion.div>
    </div>
  );
}

import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, ArrowRightLeft, Network, Bell,
  Briefcase, Users, BarChart3, Search, Menu, X,
  LogOut, ShieldCheck, Crown, UserCircle2, ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth } from "@/context/auth";

function cn(...i: string[]) { return twMerge(clsx(i)); }

const NAV_ITEMS = [
  { href: "/",             label: "Dashboard",    icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
  { href: "/fund-flow",    label: "Fund Flow",    icon: Network },
  { href: "/alerts",       label: "Alerts",       icon: Bell },
  { href: "/cases",        label: "Cases",        icon: Briefcase },
  { href: "/customers",    label: "Customers",    icon: Users },
  { href: "/reports",      label: "Reports",      icon: BarChart3 },
];

const ADMIN_NAV_ITEMS = [
  { href: "/admin/users", label: "User Management", icon: ShieldAlert },
];

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/25 rounded-full px-2 py-0.5">
        <Crown className="w-2.5 h-2.5" /> Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/25 rounded-full px-2 py-0.5">
      <UserCircle2 className="w-2.5 h-2.5" /> Investigator
    </span>
  );
}

function NavItem({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: any; onClick?: () => void }) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));
  return (
    <Link href={href} onClick={onClick}
      className={cn("flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group relative overflow-hidden",
        isActive
          ? "text-primary-foreground bg-primary/10 border border-primary/20 shadow-[inset_0_0_20px_rgba(0,255,255,0.05)]"
          : "text-sidebar-foreground hover:text-foreground hover:bg-white/5")}>
      {isActive && (
        <motion.div layoutId="activeNav"
          className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full box-glow" />
      )}
      <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "text-sidebar-foreground group-hover:text-foreground")} />
      {label}
    </Link>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [, navigate]          = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { session, logout }   = useAuth();

  const handleLogout = () => { logout(); navigate("/login"); };
  const closeMenu    = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-card/50 backdrop-blur-xl z-50">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-primary" />
          <span className="font-display font-bold text-xl tracking-wide text-foreground">Aegis<span className="text-primary">Fraud</span></span>
        </div>
        <button onClick={() => setMobileMenuOpen(v => !v)} className="text-muted-foreground hover:text-foreground">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {(mobileMenuOpen || (typeof window !== "undefined" && window.innerWidth >= 768)) && (
          <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
            className={cn("fixed md:static inset-y-0 left-0 z-40 w-64 glass-panel border-r border-y-0 border-l-0 flex flex-col",
              "transition-transform duration-300 ease-in-out md:translate-x-0",
              mobileMenuOpen ? "translate-x-0" : "-translate-x-full")}>

            {/* Logo */}
            <div className="p-6 hidden md:flex items-center gap-3 border-b border-white/5">
              <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <span className="font-display font-bold text-2xl tracking-wide text-foreground">
                Aegis<span className="text-primary">.</span>
              </span>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map(item => (
                <NavItem key={item.href} {...item} onClick={closeMenu} />
              ))}

              {/* Admin section */}
              {session?.role === "admin" && (
                <>
                  <div className="px-4 pt-5 pb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Administration</p>
                  </div>
                  {ADMIN_NAV_ITEMS.map(item => (
                    <NavItem key={item.href} {...item} onClick={closeMenu} />
                  ))}
                </>
              )}
            </nav>

            {/* User profile */}
            <div className="p-4 border-t border-white/5 space-y-2">
              {session && (
                <>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-primary-foreground font-bold font-display shadow-lg shadow-primary/20 shrink-0 text-sm">
                      {session.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-foreground">{session.name}</p>
                      <div className="mt-0.5"><RoleBadge role={session.role} /></div>
                    </div>
                  </div>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

        {/* Navbar */}
        <header className="h-20 glass-panel border-b border-x-0 border-t-0 flex items-center justify-between px-8 z-10 sticky top-0">
          <div className="flex-1 flex items-center">
            <div className="relative w-full max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input type="text" placeholder="Search transactions, cases, or customers..."
                className="w-full bg-background/50 border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-all outline-none" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-sm">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-[10px]">
                  {session.initials}
                </div>
                <span className="text-foreground/80 font-medium">{session.name.split(" ")[0]}</span>
                <RoleBadge role={session.role} />
              </div>
            )}

            <button className="relative p-2.5 rounded-full hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-destructive box-glow" />
            </button>

            <button onClick={handleLogout}
              className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors border border-transparent hover:border-destructive/20"
              title="Sign Out">
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-semibold">Logout</span>
            </button>
          </div>
        </header>

        {/* Page */}
        <div className="flex-1 overflow-auto p-4 md:p-8 z-0">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="h-full w-full max-w-7xl mx-auto">
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

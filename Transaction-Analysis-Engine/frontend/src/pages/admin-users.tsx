import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Crown, UserCircle2, Trash2, RefreshCw,
  ShieldAlert, Calendar, Mail, Clock, UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...i: any[]) { return twMerge(clsx(i)); }

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "investigator";
  title: string;
  initials: string;
  createdAt: string;
  lastLogin: string | null;
}

function RolePill({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/25 rounded-full px-3 py-1">
        <Crown className="w-3 h-3" /> Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/25 rounded-full px-3 py-1">
      <UserCircle2 className="w-3 h-3" /> Investigator
    </span>
  );
}

function Avatar({ initials, role }: { initials: string; role: string }) {
  return (
    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-lg",
      role === "admin"
        ? "bg-gradient-to-tr from-amber-500/30 to-amber-400/20 border border-amber-400/30 text-amber-300"
        : "bg-gradient-to-tr from-primary/30 to-primary/10 border border-primary/30 text-primary")}>
      {initials}
    </div>
  );
}

export default function AdminUsersPage() {
  const { authFetch, session } = useAuth();
  const [, navigate]  = useLocation();
  const [users, setUsers]     = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (session && session.role !== "admin") navigate("/");
  }, [session, navigate]);

  const fetchUsers = async () => {
    setLoading(true); setError("");
    try {
      const users = await authFetch<AppUser[]>("/auth/users");
      setUsers(users);
    } catch (err: any) {
      setError(err?.message ?? "Could not load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove user "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await authFetch(`/auth/users/${id}`, { method: "DELETE" });
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err: any) {
      alert(err?.message ?? "Failed to delete user");
    } finally {
      setDeleting(null);
    }
  };

  const admins   = users.filter(u => u.role === "admin");
  const investigators = users.filter(u => u.role === "investigator");

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">User Management</h1>
          <p className="text-muted-foreground">Manage platform accounts · Admin access only</p>
        </div>
        <button onClick={fetchUsers}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all text-sm font-medium">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Users", value: users.length, icon: Users, color: "text-primary" },
          { label: "Admins", value: admins.length, icon: Crown, color: "text-amber-400" },
          { label: "Investigators", value: investigators.length, icon: UserCircle2, color: "text-blue-400" },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-2xl border border-white/5 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
              <s.icon className={cn("w-5 h-5", s.color)} />
            </div>
            <div>
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5 bg-white/[0.02] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <h2 className="font-bold text-foreground">All Accounts</h2>
          <span className="text-xs text-muted-foreground bg-white/5 border border-white/8 rounded-full px-2.5 py-0.5">{users.length}</span>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin opacity-40" />
            <p className="text-sm">Loading users…</p>
          </div>
        ) : error ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <UserPlus className="w-10 h-10 opacity-20" />
            <p className="text-sm">No users yet. Create accounts via Sign Up.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.02] border-b border-white/5 text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4">Last Login</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence>
                  {users.map((user, i) => (
                    <motion.tr key={user.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -30 }} transition={{ delay: i * 0.04 }}
                      className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar initials={user.initials} role={user.role} />
                          <div>
                            <p className="font-semibold text-foreground">{user.name}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                              <Mail className="w-3 h-3" />
                              <span className="font-mono">{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><RolePill role={user.role} /></td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">{user.title}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(user.createdAt), "MMM d, yyyy")}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.lastLogin ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {format(new Date(user.lastLogin), "MMM d, HH:mm")}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50 italic">Never</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user.id !== session?.id ? (
                          <button onClick={() => handleDelete(user.id, user.name)}
                            disabled={deleting === user.id}
                            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-transparent hover:border-destructive/20 transition-all inline-flex disabled:opacity-40">
                            {deleting === user.id
                              ? <RefreshCw className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground/40 italic px-2">You</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

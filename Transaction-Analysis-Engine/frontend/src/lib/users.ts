export type UserRole = "admin" | "user";

export interface AppUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  title: string;
  initials: string;
}

/** Mock JSON user database */
export const USERS_DB: AppUser[] = [
  {
    id: "usr-001",
    email: "tirumanimukesh@gmail.com",
    password: "Friends@",
    name: "Mukesh Tirumani",
    role: "admin",
    title: "Admin · Lead Investigator",
    initials: "MT",
  },
  {
    id: "usr-002",
    email: "analyst@aegis.com",
    password: "Analyst@123",
    name: "Alex Johnson",
    role: "user",
    title: "Fraud Analyst",
    initials: "AJ",
  },
];

export function findUser(email: string, password: string): AppUser | null {
  return (
    USERS_DB.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase().trim() &&
        u.password === password
    ) ?? null
  );
}

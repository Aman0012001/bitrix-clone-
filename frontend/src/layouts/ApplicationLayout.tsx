import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ApiError } from "../services/api";
import { useAuth } from "../modules/auth/AuthProvider";

export function ApplicationLayout() {
  const { activeOrganization, user, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    setError(null);
    setIsSigningOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (logoutError) {
      setError(
        logoutError instanceof ApiError
          ? logoutError.message
          : "Unable to sign out. Please try again.",
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link className="text-xl font-semibold tracking-tight text-slate-950" to="/app/dashboard">
            BusinessHub
          </Link>
          <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-2">
            <NavLink
              to="/app/dashboard"
              end
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`
              }
            >
              Overview
            </NavLink>
            <Link
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              to="/organizations/select"
            >
              {activeOrganization?.name ?? "Select organization"}
            </Link>
            <span className="px-2 text-sm text-slate-500">{user?.email}</span>
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={isSigningOut}
              onClick={() => void handleLogout()}
              type="button"
            >
              {isSigningOut ? "Signing out…" : "Sign out"}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        {error && (
          <p className="mb-5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}
        <Outlet />
      </main>
    </div>
  );
}

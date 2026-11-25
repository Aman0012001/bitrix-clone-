import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../modules/auth/AuthProvider";
import { ApiError, apiRequest } from "../services/api";

export function OrganizationSelectionPage() {
  const { organizations, refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  async function selectOrganization(organizationId: string) {
    setError(null);
    setSwitchingId(organizationId);
    try {
      await apiRequest(`/organizations/${organizationId}/switch`, { method: "POST" });
      await refresh();
      navigate("/app/dashboard", { replace: true });
    } catch (switchError) {
      setError(
        switchError instanceof ApiError
          ? switchError.message
          : "Unable to switch organizations. Please try again.",
      );
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">
          BusinessHub
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Choose an organization
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your access is checked against your membership in each organization.
        </p>

        {error && (
          <p className="mt-5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}

        {organizations.length > 0 ? (
          <ul className="mt-6 space-y-3">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <button
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-4 text-left hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={switchingId !== null}
                  onClick={() => void selectOrganization(organization.id)}
                  type="button"
                >
                  <span>
                    <span className="block font-semibold text-slate-900">{organization.name}</span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {organization.slug} · {organization.role}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-indigo-700">
                    {switchingId === organization.id ? "Switching..." : "Open"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-600">
            You do not belong to an active organization yet.
          </p>
        )}

        <Link
          className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          to="/organizations/new"
        >
          Create an organization
        </Link>
      </section>
    </main>
  );
}

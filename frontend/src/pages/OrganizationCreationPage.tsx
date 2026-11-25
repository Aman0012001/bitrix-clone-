import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../modules/auth/AuthProvider";
import { ApiError, apiRequest } from "../services/api";

function slugFromName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

export function OrganizationCreationPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiRequest("/organizations", {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      });
      await refresh();
      navigate("/app/dashboard", { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Unable to create the organization. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">
          BusinessHub
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Create your organization
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your organization will have its own isolated workspace and membership roles.
        </p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Organization name
            <input
              autoComplete="organization"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              maxLength={120}
              onChange={(event) => {
                const nextName = event.target.value;
                setName(nextName);
                if (!slugEdited) {
                  setSlug(slugFromName(nextName));
                }
              }}
              required
              value={name}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Organization URL
            <input
              autoCapitalize="none"
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              maxLength={63}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value.toLowerCase());
              }}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              value={slug}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Lowercase letters, numbers and single hyphens. A deleted organization keeps its URL reserved.
            </span>
          </label>
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {error}
            </p>
          )}
          <button
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Creating organization..." : "Create organization"}
          </button>
        </form>
      </section>
    </main>
  );
}

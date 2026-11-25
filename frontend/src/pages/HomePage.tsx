export function HomePage() {
  return (
    <section aria-labelledby="welcome-heading" className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">
          Workspace overview
        </p>
        <h1 id="welcome-heading" className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Your workspace is ready
        </h1>
        <p className="mt-2 text-base leading-7 text-slate-600">
          BusinessHub authentication and organization access are in place. Business modules can be
          added to this organization-scoped foundation.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">
        No business records yet.
      </div>
    </section>
  );
}

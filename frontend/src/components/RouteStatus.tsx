import type { PropsWithChildren } from "react";

export function RouteStatus({ children }: PropsWithChildren) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
        {children}
      </div>
    </main>
  );
}

export function LoadingStatus() {
  return (
    <RouteStatus>
      <p className="text-sm font-medium text-slate-600" role="status">
        Loading your workspace...
      </p>
    </RouteStatus>
  );
}

import type { ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { LoadingStatus, RouteStatus } from "../components/RouteStatus";
import { ApplicationLayout } from "../layouts/ApplicationLayout";
import { useAuth } from "../modules/auth/AuthProvider";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { OrganizationCreationPage } from "../pages/OrganizationCreationPage";
import { OrganizationSelectionPage } from "../pages/OrganizationSelectionPage";
import { RegistrationPage } from "../pages/RegistrationPage";

function RequireAuthentication() {
  const auth = useAuth();

  if (auth.status === "loading") {
    return <LoadingStatus />;
  }
  if (auth.status === "error") {
    return (
      <RouteStatus>
        <p className="text-sm text-rose-700" role="alert">
          {auth.error}
        </p>
        <button
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => void auth.refresh()}
          type="button"
        >
          Try again
        </button>
      </RouteStatus>
    );
  }
  if (auth.status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function RequireActiveOrganization() {
  const auth = useAuth();
  if (!auth.activeOrganization) {
    return (
      <Navigate
        to={auth.organizations.length > 0 ? "/organizations/select" : "/organizations/new"}
        replace
      />
    );
  }
  return <Outlet />;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.status === "loading") {
    return <LoadingStatus />;
  }
  if (auth.status === "authenticated") {
    const destination =
      auth.organizations.length === 0
        ? "/organizations/new"
        : auth.activeOrganization
          ? "/app/dashboard"
          : "/organizations/select";
    return <Navigate to={destination} replace />;
  }
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegistrationPage />
          </PublicOnly>
        }
      />
      <Route element={<RequireAuthentication />}>
        <Route path="/organizations/new" element={<OrganizationCreationPage />} />
        <Route path="/organizations/select" element={<OrganizationSelectionPage />} />
        <Route element={<RequireActiveOrganization />}>
          <Route path="/app" element={<ApplicationLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<HomePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

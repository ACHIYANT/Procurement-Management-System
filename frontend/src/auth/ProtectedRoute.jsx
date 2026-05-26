import { Navigate, Outlet } from "react-router-dom";
import { canAccessFeature, getCurrentUserRoles } from "@/lib/roles";

const normalizeRoles = (roles) =>
  Array.isArray(roles)
    ? roles.map((role) => String(role || "").trim().toUpperCase()).filter(Boolean)
    : [];

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("me") || "null");
  } catch {
    return null;
  }
};

export default function ProtectedRoute({
  user,
  anyOf = [],
  moduleKey,
  action = "view",
  allowAdminOverride = true,
  children,
}) {
  const storedUser = getStoredUser();
  const effectiveUser = user || storedUser;
  const effectiveRoles = normalizeRoles(
    effectiveUser?.roles?.length ? effectiveUser.roles : getCurrentUserRoles(),
  );
  const hasClientSession = Boolean(
    effectiveUser || effectiveRoles.length || localStorage.getItem("fullname"),
  );

  if (!hasClientSession) {
    return <Navigate to="/login" replace />;
  }

  const requiredRoles = normalizeRoles(anyOf);
  if (requiredRoles.length && !requiredRoles.some((role) => effectiveRoles.includes(role))) {
    return <div className="p-6 text-red-600">You don’t have access to this page.</div>;
  }

  if (moduleKey && !canAccessFeature(effectiveRoles, moduleKey, action, { allowAdminOverride })) {
    return <div className="p-6 text-red-600">You don’t have access to this page.</div>;
  }

  return children || <Outlet />;
}

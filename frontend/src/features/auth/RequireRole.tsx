import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "./useAuth";
import type { UserRole } from "./auth.types";

interface RequireRoleProps {
  allowed: UserRole[];
}

export function RequireRole({
  allowed,
}: RequireRoleProps) {
  const { user } = useAuth();

  if (!user || !allowed.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}

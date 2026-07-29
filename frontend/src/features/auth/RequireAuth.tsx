import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import { FullPageLoader } from
  "../../components/ui/FullPageLoader";
import { useAuth } from "./useAuth";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "restoring") {
    return (
      <FullPageLoader label="Восстанавливаем сессию" />
    );
  }

  if (status === "anonymous") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
}

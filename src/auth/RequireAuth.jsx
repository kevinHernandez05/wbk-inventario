import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function RequireAuth({ children }) {
  const { session, loading } = useAuth();

  if (loading) return null; // puedes meter skeleton luego
  if (!session) return <Navigate to="/auth" replace />;
  return children;
}

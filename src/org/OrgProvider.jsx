import { createContext, useContext, useEffect, useState } from "react";
import { bootstrapOrgIfNeeded } from "../lib/bootstrapOrg";
import { useAuth } from "../auth/AuthProvider";

const OrgCtx = createContext(null);

export function OrgProvider({ children }) {
  const { session, loading } = useAuth();
  const [orgId, setOrgId] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Espera a que Auth termine de cargar
    if (loading) return;

    // Si no hay sesión, no bootstrap
    if (!session?.user) {
      setOrgId(null);
      setLoadingOrg(false);
      return;
    }

    setLoadingOrg(true);
    bootstrapOrgIfNeeded()
      .then((x) => mounted && setOrgId(x.orgId))
      .catch(console.error)
      .finally(() => mounted && setLoadingOrg(false));

    return () => {
      mounted = false;
    };
  }, [loading, session]);

  return <OrgCtx.Provider value={{ orgId, loadingOrg }}>{children}</OrgCtx.Provider>;
}

export function useOrg() {
  return useContext(OrgCtx);
}

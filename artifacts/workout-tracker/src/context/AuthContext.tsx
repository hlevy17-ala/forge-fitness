import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getStoredToken, clearToken, ensureGuestSession } from "@/lib/auth";
import { useGetMe, useLogout } from "@workspace/api-client-react";

interface AuthUser {
  id: number;
  email: string | null;
  isGuest: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [provisioned, setProvisioned] = useState(Boolean(getStoredToken()));

  useEffect(() => {
    if (provisioned) return;
    ensureGuestSession().then(() => setProvisioned(true));
  }, [provisioned]);

  const { data: user, isLoading, isError } = useGetMe({
    query: { enabled: provisioned, retry: false },
  });

  const { mutate: logoutMutate } = useLogout();

  const loading = !provisioned || isLoading;
  const resolvedUser = provisioned && !isError && user ? (user as AuthUser) : null;

  function logout() {
    logoutMutate(undefined, {
      onSettled: async () => {
        clearToken();
        queryClient.clear();
        await ensureGuestSession();
        queryClient.invalidateQueries();
        window.location.href = "/";
      },
    });
  }

  return (
    <AuthContext.Provider value={{ user: resolvedUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

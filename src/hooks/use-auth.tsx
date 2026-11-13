import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { fetchProfile, qk } from "@/lib/api";
import type { Profile } from "@/lib/types";

interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  profileLoading: boolean;
  profileError: Error | null;
  refetchProfile: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        router.navigate({ to: "/login" });
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        router.invalidate();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  const uid = session?.user.id;
  const profileQuery = useQuery({
    queryKey: qk.profile(uid ?? "anon"),
    queryFn: () => fetchProfile(uid!),
    enabled: !!uid,
    staleTime: 60_000,
  });

  const roleSlug = profileQuery.data?.role;
  const permissionsQuery = useQuery({
    queryKey: ["my-role-permissions", roleSlug],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_role_permissions")
        .select("permission_key").eq("role_slug", roleSlug!);
      if (error) throw error;
      return (data ?? []).map((row) => row.permission_key as string);
    },
    enabled: !!roleSlug && roleSlug !== "superuser" && roleSlug !== "pending",
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile: profileQuery.data ? { ...profileQuery.data, permissions: roleSlug === "superuser" ? ["*"] : permissionsQuery.data ?? [] } : null,
      profileLoading: !!uid && (profileQuery.isPending || (!!roleSlug && roleSlug !== "superuser" && roleSlug !== "pending" && permissionsQuery.isPending)),
      profileError: (profileQuery.error as Error | null) ?? (permissionsQuery.error as Error | null) ?? null,
      refetchProfile: () => void profileQuery.refetch(),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [ready, session, uid, profileQuery.data, profileQuery.isPending, profileQuery.error, profileQuery, permissionsQuery.data, permissionsQuery.isPending, permissionsQuery.error, roleSlug],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** For pages under the authenticated layout: profile is guaranteed there. */
export function useMe(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error("Profile not loaded");
  return profile;
}
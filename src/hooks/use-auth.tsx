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

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile: profileQuery.data ?? null,
      profileLoading: !!uid && profileQuery.isPending,
      profileError: (profileQuery.error as Error | null) ?? null,
      refetchProfile: () => void profileQuery.refetch(),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [ready, session, uid, profileQuery.data, profileQuery.isPending, profileQuery.error, profileQuery],
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
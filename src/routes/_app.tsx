import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Clock, LogOut, RefreshCw, UserX } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common";
import { personName } from "@/lib/format";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { profile, profileLoading, profileError, refetchProfile, signOut, user } = useAuth();

  if (profileLoading) return <div className="min-h-screen"><LoadingState label="Загружаем профиль…" /></div>;

  if (profileError || !profile)
    return (
      <Gate
        icon={<UserX className="size-6" />}
        title={profileError ? "Не удалось загрузить профиль" : "Профиль ещё не создан"}
        text={
          profileError?.message ??
          "Обычно профиль появляется сразу после регистрации. Обновите через несколько секунд или обратитесь к руководителю."
        }
        onRetry={refetchProfile}
        onSignOut={signOut}
      />
    );

  if (profile.role === "pending" || !profile.active)
    return (
      <Gate
        icon={<Clock className="size-6" />}
        title={profile.active ? "Ожидает назначения роли" : "Доступ отключён"}
        text={
          profile.active
            ? `${personName(profile)}, ваш аккаунт (${user?.email ?? ""}) создан. Руководитель производства назначит вам роль — после этого откроется рабочее пространство.`
            : "Ваш аккаунт деактивирован руководителем. Если это ошибка — свяжитесь с руководителем."
        }
        onRetry={refetchProfile}
        onSignOut={signOut}
      />
    );

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-11 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur">
          <SidebarTrigger />
          <span className="text-sm font-medium text-muted-foreground md:hidden">Контент-продакшн</span>
        </header>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function Gate(props: {
  icon: React.ReactNode;
  title: string;
  text: string;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          {props.icon}
        </div>
        <h1 className="text-lg font-semibold">{props.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{props.text}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={props.onRetry}>
            <RefreshCw /> Проверить снова
          </Button>
          <Button variant="ghost" onClick={props.onSignOut}>
            <LogOut /> Выйти
          </Button>
        </div>
      </div>
    </div>
  );
}
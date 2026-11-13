import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BarChart3, FolderKanban, LogOut, Moon, Sun, Tags, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth, useMe } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { ROLE_LABELS } from "@/lib/labels";
import { personName } from "@/lib/format";
import { canManageCategories, canManageEmployees, canViewAnalytics } from "@/lib/permissions";
import { Avatar } from "@/components/common";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const me = useMe();
  const { signOut, user } = useAuth();
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const roleTitle=useQuery({
    queryKey:["app-role-name",me.role],
    queryFn:async()=>{const {data,error}=await supabase.from("app_roles").select("name").eq("slug",me.role).maybeSingle();if(error)throw error;return data?.name;},
    staleTime:30_000
  });

  const items = [
    { to: "/tasks", label: "Заявки", icon: FolderKanban, show: true },
    { to: "/analytics", label: "Аналитика", icon: BarChart3, show: canViewAnalytics(me) },
    { to: "/employees", label: "Сотрудники и роли", icon: Users, show: canManageEmployees(me) },
    { to: "/categories", label: "Категории и нормативы", icon: Tags, show: canManageCategories(me) },
  ] as const;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-xs font-medium text-primary-foreground">
            CP
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">Контент-продакшн</p>
            <p className="truncate text-xs text-muted-foreground">AI Content CRM</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Работа</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((i) => i.show)
                .map((i) => (
                  <SidebarMenuItem key={i.to}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(i.to)} tooltip={i.label}>
                      <Link to={i.to}>
                        <i.icon />
                        <span>{i.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-md p-1.5">
          <Avatar person={me} className="size-8 text-xs" />
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">{personName(me)}</p>
            <p className="truncate text-xs text-muted-foreground" title={user?.email}>
              {roleTitle.data ?? ROLE_LABELS[me.role] ?? me.role}
            </p>
          </div>
        </div>
        <div className="flex gap-1 group-data-[collapsible=icon]:flex-col">
          <Button variant="ghost" size="icon" onClick={toggle} title="Сменить тему">
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} title="Выйти">
            <LogOut />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
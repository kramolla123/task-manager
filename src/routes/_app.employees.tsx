import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProfiles } from "@/hooks/use-data";
import { useMe } from "@/hooks/use-auth";
import { qk,manageEmployee,manageRole } from "@/lib/api";
import { hasPermission,canManageEmployees } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/labels";
import { supabase } from "@/lib/supabase";
import { PageHeader,LoadingState,ErrorState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Profile,Role,AppRole,AppPermission,AppRolePermission } from "@/lib/types";

export const Route=createFileRoute("/_app/employees")({component:EmployeesPage});
type Draft={slug:string;name:string;description:string;active:boolean;permissions:string[];isNew:boolean};
const ROLES_KEY=["rbac","roles"] as const;
const PERMS_KEY=["rbac","permissions"] as const;
const ASSIGN_KEY=["rbac","assignments"] as const;

function EmployeesPage(){
 const me=useMe(),profiles=useProfiles(),qc=useQueryClient();
 const isRoot=me.role==="superuser",isManager=canManageEmployees(me);
 const [tab,setTab]=useState<"staff"|"roles">("staff");
 const [changes,setChanges]=useState<Record<string,{role:Role;active:boolean}>>({});
 const [busy,setBusy]=useState<string|null>(null);
 const [draft,setDraft]=useState<Draft|null>(null);
 const rolesQuery=useQuery({
  queryKey:ROLES_KEY, queryFn:async()=>{
   const {data,error}=await supabase.from("app_roles").select("*").order("name");
   if(error)throw error;
   return (data??[]) as AppRole[];
  },staleTime:15_000
 });
 const permsQuery=useQuery({
  queryKey:PERMS_KEY,queryFn:async()=>{
   const {data,error}=await supabase.from("app_permissions").select("*").order("group_name").order("label");
   if(error)throw error;
   return (data??[]) as AppPermission[];
  },enabled:isRoot
 });
 const grantsQuery=useQuery({
  queryKey:ASSIGN_KEY,queryFn:async()=>{
   const {data,error}=await supabase.from("app_role_permissions").select("role_slug,permission_key");
   if(error)throw error;
   return (data??[]) as AppRolePermission[];
  },enabled:isRoot
 });
 const auditQuery=useQuery({
  queryKey:["rbac","audit"],queryFn:async()=>{
   const {data,error}=await supabase.from("role_audit").select("id,actor_id,action,subject,detail,created_at").order("created_at",{ascending:false}).limit(15);
   if(error)throw error;
   return data??[];
  },enabled:isRoot&&tab==="roles"
 });
 const groups=useMemo(()=>{
  const m=new Map<string,AppPermission[]>();
  for(const p of permsQuery.data??[])m.set(p.group_name,[...(m.get(p.group_name)??[]),p]);
  return [...m.entries()];
 },[permsQuery.data]);
 const editableRoles=(rolesQuery.data??[]).filter(r=>r.active||r.slug==="pending");
 const editRole=(r:AppRole)=>{
  const permissions=(grantsQuery.data??[]).filter(x=>x.role_slug===r.slug).map(x=>x.permission_key);
  setDraft({slug:r.slug,name:r.name,description:r.description,active:r.active,permissions,isNew:false});
 };
 const newRole=()=>setDraft({slug:"",name:"",description:"",active:true,permissions:[],isNew:true});
 const changeGrant=(key:string,yes:boolean)=>setDraft(d=>d?{...d,permissions:yes?[...new Set([...d.permissions,key])]:d.permissions.filter(x=>x!==key)}:d);
 const saveRole=async()=>{
  if(!draft||!isRoot)return;
  if(!/^[a-z][a-z0-9_]{2,39}$/.test(draft.slug))return toast.error("Код роли: 3–40 латинских букв, цифры и _");
  if(draft.name.trim().length<2)return toast.error("Введите название роли");
  setBusy("role");
  try{
   await manageRole({action:draft.isNew?"create":"update",slug:draft.slug,name:draft.name.trim(),description:draft.description,permissions:draft.permissions,active:draft.active});
   await Promise.all([qc.invalidateQueries({queryKey:ROLES_KEY}),qc.invalidateQueries({queryKey:ASSIGN_KEY}),qc.invalidateQueries({queryKey:["rbac","audit"]}),qc.invalidateQueries({queryKey:["my-role-permissions"]})]);
   setDraft(null);toast.success("Роль и её разрешения сохранены");
  }catch(e){toast.error(e instanceof Error?e.message:"Не удалось сохранить роль");}finally{setBusy(null)}
 };
 const deleteRole=async()=>{
  if(!draft||draft.isNew||!isRoot)return;
  const role=rolesQuery.data?.find(r=>r.slug===draft.slug);
  if(!role||role.is_system)return;
  if(!window.confirm(`Удалить роль «${draft.name}»? Только если она никому не назначена.`))return;
  setBusy("role");
  try{
   await manageRole({action:"delete",slug:draft.slug,name:draft.name,description:draft.description,permissions:[],active:draft.active});
   setDraft(null);
   await Promise.all([qc.invalidateQueries({queryKey:ROLES_KEY}),qc.invalidateQueries({queryKey:ASSIGN_KEY}),qc.invalidateQueries({queryKey:["rbac","audit"]})]);
   toast.success("Роль удалена");
  }catch(e){toast.error(e instanceof Error?e.message:"Не удалось удалить роль");}finally{setBusy(null)}
 };
 const update=(p:Profile,data:Partial<{role:Role;active:boolean}>)=>setChanges(prev=>({...prev,[p.id]:{role:prev[p.id]?.role??p.role,active:prev[p.id]?.active??p.active,...data}}));
 const saveEmployee=async(p:Profile)=>{
  const c=changes[p.id];if(!c)return;
  setBusy(p.id);
  try{
   await manageEmployee(p.id,c.role,c.active);
   await qc.invalidateQueries({queryKey:qk.profiles});
   if(p.id===me.id){await qc.invalidateQueries({queryKey:qk.profile(me.id)});await qc.invalidateQueries({queryKey:["my-role-permissions"]});}
   setChanges(prev=>{const next={...prev};delete next[p.id];return next});
   toast.success("Роль сотрудника обновлена");
  }catch(e){toast.error(e instanceof Error?e.message:"Не удалось изменить сотрудника");}finally{setBusy(null)}
 };
 if(!isManager&&!isRoot)return <div>Недостаточно прав для управления сотрудниками</div>;
 if(profiles.isPending||rolesQuery.isPending)return <LoadingState/>;
 if(profiles.error||rolesQuery.error)return <ErrorState error={profiles.error??rolesQuery.error} onRetry={()=>{profiles.refetch();rolesQuery.refetch()}}/>;
 return <div className="space-y-5">
  <PageHeader title="Сотрудники и роли" description="Доступ к действиям проверяет Supabase. Роли можно менять без обновления кода приложения." actions={isRoot&&tab==="roles"?<Button onClick={newRole}>Создать роль</Button>:undefined}/>
  <div className="flex gap-2 border-b pb-2">
   <Button variant={tab==="staff"?"default":"ghost"} onClick={()=>setTab("staff")}>Сотрудники</Button>
   {isRoot&&<Button variant={tab==="roles"?"default":"ghost"} onClick={()=>setTab("roles")}>Роли и разрешения</Button>}
  </div>
  {tab==="staff"&&<div className="space-y-2">
   <p className="text-sm text-muted-foreground">Новые пользователи появляются здесь после регистрации с ролью «Ожидает назначения». Выберите роль и сохраните.</p>
   {profiles.list.length===0&&<p className="rounded-lg border p-5 text-muted-foreground">Сотрудников пока нет.</p>}
   {profiles.list.map(p=>{
    const c=changes[p.id],selected=c?.role??p.role,active=c?.active??p.active;
    const canEdit=isRoot || (hasPermission(me,"employees.manage")&&p.role!=="superuser") ||
     (hasPermission(me,"employees.manage_sales")&&["pending","sales_manager"].includes(p.role));
    const choices=editableRoles.filter(r=>isRoot||r.slug!=="superuser"&&(hasPermission(me,"employees.manage")||["pending","sales_manager"].includes(r.slug)));
    return <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
     <div className="min-w-40 flex-1"><p className="font-medium">{p.full_name||"Без имени"}</p><p className="text-xs text-muted-foreground">{p.telegram||p.id}</p></div>
     <select aria-label="Роль сотрудника" className="max-w-56 rounded-md border bg-background p-2 text-sm" value={selected} disabled={!canEdit} onChange={e=>update(p,{role:e.target.value})}>
      {choices.map(r=><option key={r.slug} value={r.slug}>{r.name}</option>)}
      {!choices.some(r=>r.slug===selected)&&<option value={selected}>{selected}</option>}
     </select>
     <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} disabled={!canEdit||p.id===me.id} onChange={e=>update(p,{active:e.target.checked})}/>Активен</label>
     <Button size="sm" disabled={!canEdit||!c||busy===p.id} onClick={()=>saveEmployee(p)}>Сохранить</Button>
    </div>
   })}
  </div>}
  {tab==="roles"&&isRoot&&<div className="space-y-5">
   <p className="text-sm text-muted-foreground">Нажмите на роль, чтобы выбрать разрешения. Системная роль Superuser обладает полным доступом и защищена от редактирования. Роль без назначенных прав не может выполнять действия.</p>
   <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
    {(rolesQuery.data??[]).map(r=><button type="button" key={r.slug} onClick={()=>r.slug==="superuser"||r.slug==="pending"?setDraft(null):editRole(r)} className={`rounded-lg border bg-card p-4 text-left transition hover:border-primary ${draft?.slug===r.slug?"border-primary":""}`}>
     <div className="flex justify-between gap-2"><strong>{r.name}</strong><span className="text-xs text-muted-foreground">{r.is_system?"Системная":"Настраиваемая"}</span></div>
     <p className="mt-1 font-mono text-xs text-muted-foreground">{r.slug}</p><p className="mt-2 text-xs text-muted-foreground">{r.active?"Активна":"Отключена"} · {(grantsQuery.data??[]).filter(x=>x.role_slug===r.slug).length} разрешений</p>
    </button>)}
   </div>
   {draft&&<div className="rounded-xl border bg-card p-5 space-y-4">
    <h2 className="text-lg font-semibold">{draft.isNew?"Новая роль":`Редактирование: ${draft.name}`}</h2>
    <div className="grid gap-3 md:grid-cols-2">
     <label className="space-y-1 text-sm">Код роли <Input disabled={!draft.isNew} value={draft.slug} onChange={e=>setDraft({...draft,slug:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"")})} placeholder="content_reviewer"/></label>
     <label className="space-y-1 text-sm">Название <Input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Контент-ревьюер"/></label>
    </div>
    <label className="block space-y-1 text-sm">Описание<Textarea value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>Роль активна</label>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Разрешения на действия</h3><div className="flex gap-2">
     <Button variant="outline" size="sm" onClick={()=>setDraft({...draft,permissions:(permsQuery.data??[]).map(p=>p.key)})}>Выбрать все</Button>
     <Button variant="outline" size="sm" onClick={()=>setDraft({...draft,permissions:[]})}>Снять все</Button>
    </div></div>
    {permsQuery.isPending||grantsQuery.isPending?<LoadingState/>:permsQuery.error||grantsQuery.error?<ErrorState error={permsQuery.error??grantsQuery.error}/>:<div className="grid gap-4 lg:grid-cols-2">
      {groups.map(([group,perms])=><section key={group} className="rounded-lg border p-4 space-y-3">
       <h4 className="font-semibold">{group}</h4>
       {perms.map(p=><label key={p.key} className="flex cursor-pointer gap-3 text-sm">
        <input className="mt-1" type="checkbox" checked={draft.permissions.includes(p.key)} onChange={e=>changeGrant(p.key,e.target.checked)}/>
        <span><span>{p.label}</span><span className="block font-mono text-xs text-muted-foreground">{p.key}</span></span>
       </label>)}
      </section>)}
    </div>}
    <p className="text-xs text-muted-foreground">Некоторые разрешения зависят от других: например, для просмотра заявок нужен доступ к заявкам, а для загрузки AI — назначение креатором и соответствующий этап процесса.</p>
    <div className="flex flex-wrap gap-2">
     <Button disabled={busy==="role"} onClick={saveRole}>Сохранить роль</Button>
     <Button variant="outline" onClick={()=>setDraft(null)} disabled={busy==="role"}>Отмена</Button>
     {!draft.isNew&&!rolesQuery.data?.find(r=>r.slug===draft.slug)?.is_system&&<Button variant="destructive" disabled={busy==="role"} onClick={deleteRole}>Удалить роль</Button>}
    </div>
   </div>}
   <section className="space-y-2"><h3 className="font-semibold">Последние изменения ролей</h3>
    {(auditQuery.data??[]).map(row=><p key={row.id} className="rounded-md border p-2 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("ru-RU")} · {row.action} · {row.subject}</p>)}
    {!auditQuery.data?.length&&<p className="text-sm text-muted-foreground">Изменений пока нет</p>}
   </section>
  </div>}
 </div>;
}

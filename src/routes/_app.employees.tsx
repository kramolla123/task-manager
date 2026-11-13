import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProfiles } from "@/hooks/use-data";
import { useMe } from "@/hooks/use-auth";
import { qk,manageEmployee } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/labels";
import { PageHeader,LoadingState,ErrorState } from "@/components/common";
import { Button } from "@/components/ui/button";
import type { Profile,Role } from "@/lib/types";
export const Route=createFileRoute("/_app/employees")({component:EmployeesPage});
function EmployeesPage(){
 const me=useMe(),profiles=useProfiles(),qc=useQueryClient();
 const [changes,setChanges]=useState<Record<string,{role:Role;active:boolean}>>({});
 const [busy,setBusy]=useState<string|null>(null);
 if(profiles.isPending)return <LoadingState/>;
 if(profiles.error)return <ErrorState error={profiles.error} onRetry={()=>profiles.refetch()}/>;
 if(!["production_head","sales_head"].includes(me.role))return <div>Недостаточно прав</div>;
 const update=(p:Profile,data:Partial<{role:Role;active:boolean}>)=>setChanges(prev=>({...prev,[p.id]:{role:prev[p.id]?.role??p.role,active:prev[p.id]?.active??p.active,...data}}));
 const save=async(p:Profile)=>{
  const c=changes[p.id];if(!c)return;
  setBusy(p.id);
  try{await manageEmployee(p.id,c.role,c.active);await qc.invalidateQueries({queryKey:qk.profiles});toast.success("Права сотрудника сохранены");setChanges(prev=>{const o={...prev};delete o[p.id];return o});}
  catch(e){toast.error(e instanceof Error?e.message:"Ошибка");}
  finally{setBusy(null)}
 };
 return <div className="space-y-5">
  <PageHeader title="Сотрудники" description="Роли применяются на сервере. Новые пользователи регистрируются самостоятельно и ожидают назначения."/>
  <div className="space-y-2">{profiles.list.map(p=>{
   const c=changes[p.id],selected=c?.role??p.role,active=c?.active??p.active;
   const roles=(Object.keys(ROLE_LABELS) as Role[]).filter(r=>me.role==="production_head"||r==="sales_manager"||r==="pending");
   const editable=me.role==="production_head" || (me.role==="sales_head"&&["pending","sales_manager"].includes(p.role));
   return <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
    <div className="min-w-40 flex-1"><div className="font-medium">{p.full_name||"Без имени"}</div><div className="text-xs text-muted-foreground">{p.telegram||p.id}</div></div>
    <select aria-label="Роль" className="rounded-md border bg-background p-2 text-sm" value={selected} disabled={!editable} onChange={e=>update(p,{role:e.target.value as Role})}>
    {roles.map(r=><option value={r} key={r}>{ROLE_LABELS[r]}</option>)}</select>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} disabled={!editable||p.id===me.id} onChange={e=>update(p,{active:e.target.checked})}/>Активен</label>
    <Button size="sm" disabled={!editable||!c||busy===p.id} onClick={()=>save(p)}>Сохранить</Button>
   </div>
  })}</div>
 </div>;
}
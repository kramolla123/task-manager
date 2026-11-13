import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCategories } from "@/hooks/use-data";
import { useMe } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { saveCategory,qk } from "@/lib/api";
import { PageHeader,LoadingState,ErrorState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Category } from "@/lib/types";

export const Route=createFileRoute("/_app/categories")({component:CategoriesPage});
function CategoriesPage(){
 const me=useMe(), q=useCategories(), qc=useQueryClient();
 const [editing,setEditing]=useState<Partial<Category>|null>(null);
 const [busy,setBusy]=useState(false);
 if(q.isPending)return <LoadingState/>;
 if(q.error)return <ErrorState error={q.error} onRetry={()=>q.refetch()}/>;
 const canEdit=me.role==="production_head";
 const save=async()=>{
  if(!editing?.name?.trim() || !editing?.route || !(Number(editing.deadline_days)>0)) return toast.error("Заполните название, маршрут и норматив");
  setBusy(true);
  try{
   await saveCategory({...editing,name:editing.name.trim(),deadline_days:Number(editing.deadline_days)});
   await qc.invalidateQueries({queryKey:qk.categories});
   setEditing(null);toast.success("Категория сохранена. Существующие дедлайны не меняются.");
  }catch(e){toast.error(e instanceof Error?e.message:"Ошибка");}finally{setBusy(false)}
 };
 return <div className="space-y-5">
 <PageHeader title="Категории и нормативы" description="Настройки действуют только для новых заявок." actions={canEdit?<Button onClick={()=>setEditing({name:"",description:"",instructions:"",deadline_days:2,route:"testing",active:true})}>Добавить категорию</Button>:undefined}/>
 <div className="grid gap-3 lg:grid-cols-2">{q.list.map(c=><div key={c.id} className="rounded-xl border bg-card p-5 space-y-2">
 <div className="flex items-center justify-between"><h3 className="font-semibold">{c.name}</h3><span className="text-xs text-muted-foreground">{c.active?"Активна":"Отключена"}</span></div>
 <p className="text-sm text-muted-foreground">{c.description||"Без описания"}</p>
 <p className="text-sm">Маршрут: {c.route==="testing"?"Тестирование":"Дизайн"} · Норматив: <b>{c.deadline_days} дн.</b></p>
 {c.instructions&&<p className="text-sm">Инструкция: {c.instructions}</p>}
 {canEdit&&<Button variant="outline" size="sm" onClick={()=>setEditing({...c})}>Редактировать</Button>}
 </div>)}</div>
 {editing&&canEdit&&<div className="rounded-xl border bg-card p-5 space-y-3">
 <h3 className="font-semibold">{editing.id?"Редактирование категории":"Новая категория"}</h3>
 <label className="block text-sm">Название<Input value={editing.name??""} onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
 <label className="block text-sm">Описание<Textarea value={editing.description??""} onChange={e=>setEditing({...editing,description:e.target.value})}/></label>
 <label className="block text-sm">Инструкция<Textarea value={editing.instructions??""} onChange={e=>setEditing({...editing,instructions:e.target.value})}/></label>
 <label className="block text-sm">Норматив (дней)<Input type="number" min="1" max="365" value={editing.deadline_days??2} onChange={e=>setEditing({...editing,deadline_days:Number(e.target.value)})}/></label>
 <label className="block text-sm">Маршрут<select className="block w-full rounded-md border bg-background p-2" value={editing.route??"testing"} onChange={e=>setEditing({...editing,route:e.target.value as Category["route"]})}><option value="testing">Тестирование</option><option value="design">Дизайн</option></select></label>
 <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active??true} onChange={e=>setEditing({...editing,active:e.target.checked})}/>Активна</label>
 <div className="flex gap-2"><Button disabled={busy} onClick={save}>Сохранить</Button><Button variant="outline" disabled={busy} onClick={()=>setEditing(null)}>Отмена</Button></div>
 </div>}
 </div>
}
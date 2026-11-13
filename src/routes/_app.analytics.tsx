import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";
import { useTasks } from "@/hooks/use-data";
import { fetchRejectionsBetween,qk } from "@/lib/api";
import { PageHeader,LoadingState,ErrorState } from "@/components/common";
import { STATUS_LABELS } from "@/lib/labels";
import type { TaskStatus } from "@/lib/types";
export const Route=createFileRoute("/_app/analytics")({component:AnalyticsPage});
function AnalyticsPage(){
 const me=useMe(),data=useTasks();
 const [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7));
 const start=month+"-01T00:00:00.000Z";
 const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString();
 const isHead=hasPermission(me,"analytics.rejections");
 const review=useQuery({queryKey:qk.analytics(month),queryFn:()=>fetchRejectionsBetween(start,end),enabled:isHead});
 const tasks=useMemo(()=>data.tasks.filter(t=>t.created_at>=start&&t.created_at<end),[data.tasks,start,end]);
 const late=tasks.filter(t=>t.deadline_at&&new Date(t.deadline_at).getTime()<new Date(t.completed_at??Date.now()).getTime()&&t.status!=="cancelled").length;
 const statuses=Object.entries(tasks.reduce<Record<string,number>>((acc,t)=>{acc[t.status]=(acc[t.status]??0)+1;return acc},{}));
 const categories=Object.entries(tasks.reduce<Record<string,number>>((acc,t)=>{const name=t.category?.name??t.category_id;acc[name]=(acc[name]??0)+1;return acc},{}));
 const employees=useMemo(()=>{
  const stats=new Map<string,{count:number;rejected:number;repeat:number;ai:number;design:number}>();
  for(const t of tasks)if(t.creator_id){const v=stats.get(t.creator_id)??{count:0,rejected:0,repeat:0,ai:0,design:0};v.count++;stats.set(t.creator_id,v)}
  for(const raw of review.data??[]){
   const r=raw as typeof raw & {creator_id?:string;stage?:string;cycle?:number};
   if(!r.creator_id)continue;
   const v=stats.get(r.creator_id)??{count:0,rejected:0,repeat:0,ai:0,design:0};
   v.rejected++;if((r.cycle??0)>1)v.repeat++;
   if(r.stage==="design")v.design++;else v.ai++;
   stats.set(r.creator_id,v)
  }
  return [...stats].map(([id,v])=>({id,name:data.profiles.map.get(id)?.full_name??id,...v})).sort((a,b)=>b.rejected-a.rejected);
 },[tasks,review.data,data.profiles.map]);
 if(!hasPermission(me,"analytics.view"))return <p>Аналитика доступна только руководителям.</p>;
 if(data.isPending)return <LoadingState/>;
 if(data.error)return <ErrorState error={data.error} onRetry={()=>data.refetch()}/>;
 return <div className="space-y-5">
 <PageHeader title="Аналитика производства" description="Фактические показатели по сохранённым заявкам и циклам согласования." actions={<input aria-label="Месяц отчёта" type="month" value={month} onChange={e=>setMonth(e.target.value)} className="rounded-md border bg-background p-2"/>}/>
 <div className="grid gap-3 sm:grid-cols-3">{[["Заявок создано",tasks.length],["Просрочено",late],["Завершено",tasks.filter(t=>t.status==="completed").length]].map(([name,n])=><div key={name} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{name}</p><p className="mt-1 text-3xl font-semibold">{n}</p></div>)}</div>
 <div className="grid gap-4 md:grid-cols-2">
 <section className="rounded-xl border bg-card p-5 space-y-2"><h2 className="font-semibold">По статусам</h2>{statuses.map(([k,n])=><div key={k} className="flex justify-between text-sm"><span>{STATUS_LABELS[k as TaskStatus]??k}</span><b>{n}</b></div>)}{!statuses.length&&<p className="text-sm text-muted-foreground">Нет заявок</p>}</section>
 <section className="rounded-xl border bg-card p-5 space-y-2"><h2 className="font-semibold">По категориям</h2>{categories.map(([k,n])=><div key={k} className="flex justify-between text-sm"><span>{k}</span><b>{n}</b></div>)}{!categories.length&&<p className="text-sm text-muted-foreground">Нет заявок</p>}</section></div>
 {isHead&&<section className="rounded-xl border bg-card p-5 space-y-3">
 <h2 className="font-semibold">Доработки сотрудников</h2><p className="text-xs text-muted-foreground">Повторное отклонение в следующем цикле считается новой правкой. Правки дизайнеров выделены отдельно.</p>
 {review.isPending?<LoadingState/>:review.error?<ErrorState error={review.error} onRetry={()=>review.refetch()}/>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Исполнитель</th><th>Задачи</th><th>Правки AI</th><th>Правки дизайна</th><th>Повторные</th></tr></thead><tbody>{employees.map(x=><tr className="border-b" key={x.id}><td className="p-2">{x.name}</td><td>{x.count}</td><td>{x.ai}</td><td>{x.design}</td><td>{x.repeat}</td></tr>)}</tbody></table></div>}
 </section>}
 </div>
}
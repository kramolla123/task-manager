import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, ExternalLink, History, Image as ImageIcon } from "lucide-react";
import { useTask,useTaskAction } from "@/hooks/use-data";
import { useSlots,useEvents,useRejections,useComments,useDesignSubmissions,useTestResults } from "@/hooks/use-task-detail";
import { useMe } from "@/hooks/use-auth";
import { qk,addComment,signedUrl } from "@/lib/api";
import { availableActions,canSeeComments,uploadableKinds } from "@/lib/permissions";
import { STATUS_LABELS,ACTION_LABELS,ASSET_KIND_LABELS,REJECTION_REASONS,REVIEW_STATE_LABELS } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";
import { DeadlineLabel,EmptyState,ErrorState,LoadingState,PageHeader,PersonChip,PriorityBadge,StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CommandDialog,val,type Values,type Field } from "@/components/tasks/detail/command-dialog";
import { FileDropzone,useUploadQueue,UploadQueueList } from "@/components/tasks/upload";
import type { TaskAction,Task,AssetKind,AssetSlot } from "@/lib/types";

export const Route=createFileRoute("/_app/tasks/$taskId")({component:TaskPage});
type Tab="info"|"materials"|"styling"|"review"|"results"|"comments"|"history";
const tabLabels:Record<Tab,string>={info:"Информация",materials:"Материалы",styling:"Стилизация",review:"Согласование",results:"Результаты",comments:"Комментарии",history:"История"};
const actionNames:Record<TaskAction,string>={
 claim:"Взять задачу",set_stylist:"Выбрать стилиста",finish_stylist:"Завершить стилизацию",
 submit_ai:"Отправить AI на проверку",stylist_review:"Заключение стилиста",approve_ai:"Утвердить AI",reject_ai:"Вернуть выбранные фото",
 start_test:"Начать тестирование",finish_test:"Сохранить CTR и завершить",assign:"Назначить исполнителя",
 submit_design:"Отправить дизайн на проверку",approve_design:"Утвердить дизайн",reject_design:"Доработать дизайн",
 update:"Изменить заявку",deadline:"Изменить дедлайн",cancel:"Отменить заявку"
};
function actionFields(action:TaskAction,task:Task,profiles:{id:string;full_name:string|null;role:string}[]):Field[]{
 const reason:Field={name:"reason",label:"Причина",type:"textarea",required:true};
 const employees=(r:string)=>profiles.filter(p=>p.role===r).map(p=>({value:p.id,label:p.full_name||p.id}));
 switch(action){
 case "set_stylist":return [{name:"required",label:"Нужен стилист",type:"switch",defaultValue:!!task.stylist_required},{name:"stylist_id",label:"Назначить стилиста (необязательно)",type:"select",options:employees("stylist"),showIf:v=>v["required"]===true}];
 case "stylist_review":return [{name:"comment",label:"Заключение",type:"textarea",required:true}];
 case "reject_ai":return [reason,{name:"comment",label:"Комментарий",type:"textarea"}];
 case "approve_ai":return [{name:"bypass_reason",label:"Причина обхода стилиста (если заключения нет)",type:"textarea"}];
 case "finish_test":return [{name:"ctr_best",label:"Лучший CTR, %",type:"number",required:true,min:0,max:100,step:0.001},{name:"ctr_worst",label:"Худший CTR, %",type:"number",required:true,min:0,max:100,step:0.001},{name:"used_main",label:"Главная фотография использована",type:"switch"},{name:"notes",label:"Примечание",type:"textarea"}];
 case "assign":return [{name:"creator_id",label:"Креатор",type:"select",options:employees("creator")},{name:"designer_id",label:"Дизайнер",type:"select",options:employees("designer")}];
 case "submit_design":return [{name:"canva_url",label:"Ссылка Canva",type:"url"},{name:"notes",label:"Комментарий",type:"textarea"}];
 case "reject_design":return [reason,{name:"comment",label:"Комментарий",type:"textarea"}];
 case "deadline":return [{name:"deadline_at",label:"Новый дедлайн",type:"datetime",required:true},reason];
 case "cancel":return [reason];
 case "update":return [
 {name:"ld_article",label:"LD артикул",type:"text",defaultValue:task.ld_article??""},
 {name:"product_url",label:"Ссылка на товар",type:"url",defaultValue:task.product_url??""},
 {name:"description",label:"Описание",type:"textarea",defaultValue:task.description??""},
 {name:"source_url",label:"Источник материалов",type:"url",defaultValue:task.source_url??""},
 {name:"requested_photos",label:"Количество фото",type:"number",min:1,max:100,defaultValue:String(task.requested_photos)},
 {name:"priority",label:"Приоритет",type:"select",options:["Low","Medium","High"].map(x=>({value:x,label:x})),defaultValue:task.priority}
 ];
 default:return [];
 }
}
function payloadFor(action:TaskAction,v:Values,selected:string[]):Record<string,unknown>{
 const str=(key:string)=>val.str(v[key]);
 if(action==="set_stylist")return {required:!!v["required"],...(str("stylist_id")?{stylist_id:str("stylist_id")}:{})};
 if(action==="reject_ai"||action==="reject_design")return {slot_ids:selected,reason:str("reason"),comment:str("comment")};
 if(action==="approve_ai")return {bypass_reason:str("bypass_reason")};
 if(action==="stylist_review")return {comment:str("comment")};
 if(action==="finish_test")return {ctr_best:val.num(v["ctr_best"]),ctr_worst:val.num(v["ctr_worst"]),used_main:!!v["used_main"],notes:str("notes")};
 if(action==="assign")return {...(str("creator_id")?{creator_id:str("creator_id")}:{}),...(str("designer_id")?{designer_id:str("designer_id")}:{})};
 if(action==="submit_design")return {canva_url:str("canva_url"),notes:str("notes")};
 if(action==="deadline")return {deadline_at:val.iso(v["deadline_at"]),reason:str("reason")};
 if(action==="cancel")return {reason:str("reason")};
 if(action==="update")return {ld_article:str("ld_article"),product_url:str("product_url"),description:str("description"),source_url:str("source_url"),requested_photos:val.num(v["requested_photos"]),priority:str("priority")};
 return {};
}
function DetailRow({title,children}:{title:string;children:ReactNode}){return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{title}</dt><dd className="mt-1 break-words text-sm">{children||"—"}</dd></div>}
function TaskPage(){
 const {taskId}=Route.useParams();
 const me=useMe(),qc=useQueryClient();
 const detail=useTask(taskId),slots=useSlots(taskId),events=useEvents(taskId),rejects=useRejections(taskId),comments=useComments(taskId,canSeeComments(me.role)),design=useDesignSubmissions(taskId),tests=useTestResults(taskId);
 const mutation=useTaskAction(taskId),uploads=useUploadQueue(taskId);
 const [tab,setTab]=useState<Tab>("info"),[active,setActive]=useState<TaskAction|null>(null),[selected,setSelected]=useState<string[]>([]),[comment,setComment]=useState(""),[busyComment,setBusyComment]=useState(false),[preview,setPreview]=useState<string|null>(null);
 const task=detail.task;
 if(detail.isPending)return <LoadingState/>;
 if(detail.error)return <ErrorState error={detail.error} onRetry={()=>detail.refetch()}/>;
 if(!task)return <EmptyState title="Заявка не найдена или недоступна"/>;
 const actions=availableActions(task,me);
 const uploadKinds=uploadableKinds(task,me);
 const grouped=Object.entries(ASSET_KIND_LABELS) as [AssetKind,string][];
 const aiSlots=(slots.data??[]).filter(s=>s.kind==="ai");
 const designSlots=(slots.data??[]).filter(s=>s.kind==="design");
 const choices=active==="reject_design"?designSlots:aiSlots;
 const canDiscuss=canSeeComments(me.role);
 const confirm=async(v:Values)=>{
  if(!active)return;
  if(active==="reject_ai"&&!selected.length)throw new Error("Выберите хотя бы одно AI-изображение");
  if(active==="reject_design"&&designSlots.length>0&&!selected.length)throw new Error("Выберите файлы дизайна");
  if(active==="assign"&&!val.str(v["creator_id"])&&!val.str(v["designer_id"]))throw new Error("Выберите исполнителя");
  await mutation.mutateAsync({action:active,payload:payloadFor(active,v,selected),success:"Действие выполнено"});
  setSelected([]);
  await Promise.all([qc.invalidateQueries({queryKey:qk.task(taskId)}),qc.invalidateQueries({queryKey:qk.tasks})]);
 };
 const openAsset=async(s:AssetSlot,download=false)=>{
  if(!s.current)return;
  try{
   const url=await signedUrl(s.current.storage_path,download?s.current.filename:undefined);
   if(download){const a=document.createElement("a");a.href=url;a.rel="noopener noreferrer";a.target="_blank";a.click();}
   else setPreview(url);
  }catch(e){toast.error(e instanceof Error?e.message:"Нет доступа")}
 };
 const submitComment=async()=>{
  if(!comment.trim())return;
  setBusyComment(true);
  try{await addComment(taskId,me.id,comment.trim());setComment("");await qc.invalidateQueries({queryKey:qk.taskPart(taskId,"comments")});}
  catch(e){toast.error(e instanceof Error?e.message:"Ошибка комментария");}
  finally{setBusyComment(false)}
 };
 const upload=async(kind:AssetKind,files:File[],slotId?:string)=>{
  const result=await uploads.enqueue(kind,files,slotId?{slotId}:undefined);
  if(result.failed)toast.error("Не удалось загрузить некоторые файлы");
  await qc.invalidateQueries({queryKey:qk.taskPart(taskId,"slots")});
 };
 return <div className="space-y-5">
  <Link to="/tasks" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4"/>К заявкам</Link>
  <PageHeader title={`Заявка №${task.number} · ${task.ld_article}`} description={task.category?.name} actions={<><PriorityBadge priority={task.priority}/><StatusBadge status={task.status}/></>}/>
  <div className="flex flex-wrap gap-2">{actions.map(action=><Button key={action} size="sm" variant={["cancel","reject_ai","reject_design"].includes(action)?"destructive":"outline"} onClick={()=>{setSelected([]);setActive(action);}}>{actionNames[action]}</Button>)}</div>
  <div className="flex gap-1 overflow-x-auto border-b">{(Object.keys(tabLabels) as Tab[]).filter(t=>t!=="comments"||canDiscuss).map(key=><button type="button" onClick={()=>setTab(key)} key={key} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab===key?"border-primary font-semibold":"border-transparent text-muted-foreground"}`}>{tabLabels[key]}</button>)}</div>
  {tab==="info"&&<dl className="grid gap-5 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
   <DetailRow title="Категория">{task.category?.name}</DetailRow><DetailRow title="Артикул">{task.ld_article}</DetailRow>
   <DetailRow title="Приоритет">{task.priority}</DetailRow><DetailRow title="Запрошено фотографий">{task.requested_photos}</DetailRow>
   <DetailRow title="Дедлайн"><DeadlineLabel task={task}/></DetailRow><DetailRow title="Создана">{fmtDateTime(task.created_at)}</DetailRow>
   <DetailRow title="Инициатор"><PersonChip person={task.initiator}/></DetailRow><DetailRow title="Креатор"><PersonChip person={task.creator}/></DetailRow>
   <DetailRow title="Стилист"><PersonChip person={task.stylist}/></DetailRow><DetailRow title="Дизайнер"><PersonChip person={task.designer}/></DetailRow>
   <DetailRow title="AI утверждено">{task.ai_approved_at?fmtDateTime(task.ai_approved_at):"—"}</DetailRow><DetailRow title="Завершена">{task.completed_at?fmtDateTime(task.completed_at):"—"}</DetailRow>
   <DetailRow title="Товар">{task.product_url?<a href={task.product_url} rel="noopener noreferrer" target="_blank" className="text-primary underline">Открыть товар <ExternalLink className="inline size-3"/></a>:"—"}</DetailRow>
   <DetailRow title="Исходные материалы">{task.source_url?<a href={task.source_url} rel="noopener noreferrer" target="_blank" className="text-primary underline">Открыть источник</a>:"—"}</DetailRow>
   <div className="sm:col-span-2"><DetailRow title="Описание">{task.description}</DetailRow></div>
  </dl>}
  {tab==="materials"&&<div className="space-y-5">
   {grouped.map(([kind,label])=>{
    const group=(slots.data??[]).filter(s=>s.kind===kind);
    const enabled=uploadKinds.includes(kind);
    return <section key={kind} className="space-y-3 rounded-xl border bg-card p-4"><h2 className="font-semibold">{label} <span className="text-sm font-normal text-muted-foreground">({group.length})</span></h2>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.map(slot=><div key={slot.id} className="rounded-lg border p-3 space-y-2">
     <div className="flex items-center justify-between gap-2"><span className="text-sm">Фото #{slot.slot_number}</span><span className="text-xs text-muted-foreground">{REVIEW_STATE_LABELS[slot.review_state]}</span></div>
     {slot.current?<><button type="button" onClick={()=>openAsset(slot)} className="flex min-h-28 w-full flex-col items-center justify-center rounded-md bg-muted p-3 text-sm"><ImageIcon className="size-6"/><span className="mt-2 break-all">{slot.current.filename}</span><span className="text-xs">Версия {slot.current.version_number}</span></button>
     <Button size="sm" variant="outline" onClick={()=>openAsset(slot,true)}><Download className="size-3"/> Скачать</Button>
     <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">История версий ({slot.versions.length})</summary>{slot.versions.map(version=><p key={version.id}>v{version.version_number} · {version.filename} · {fmtDateTime(version.created_at)}</p>)}</details>
     </>:<p className="text-sm text-muted-foreground">Файл не зарегистрирован</p>}
     {enabled&&((kind==="ai"&&slot.review_state==="rejected")||kind==="design"||kind==="manager_reference")&&<FileDropzone compact hint="Заменить этот файл" onFiles={files=>upload(kind,files.slice(0,1),slot.id)}/>}
    </div>)}</div>
    {!group.length&&<p className="text-sm text-muted-foreground">Файлы пока не добавлены</p>}
    {enabled&&<FileDropzone accept="image/jpeg,image/png,image/webp,image/gif" compact hint="JPG, PNG, WebP, GIF · до 15 МБ за файл" onFiles={files=>upload(kind,files)}/>}
    </section>
   })}<UploadQueueList items={uploads.items}/></div>}
  {tab==="styling"&&<div className="rounded-xl border bg-card p-5 space-y-3">
   <p>Стилист: <PersonChip person={task.stylist}/></p><p>Стилизация: <b>{task.stylist_required?"Требуется":"Не требуется"}</b></p>
   <p>Номер текущего цикла: {task.current_cycle}</p>
   {task.stylist_required&&<p className="text-sm text-muted-foreground">Перед утверждением требуется заключение стилиста либо документированный обход руководителя.</p>}
   {(slots.data??[]).filter(s=>s.kind==="stylist_reference").map(s=><p key={s.id}>{s.current?.filename??"Файл ожидается"}</p>)}
  </div>}
  {tab==="review"&&<div className="space-y-4">
   <p className="text-sm text-muted-foreground">AI цикл #{task.current_cycle}; дизайн цикл #{task.design_cycle}. Отметьте изображения перед отправкой на доработку. Одобряемые изображения сохраняются без изменений.</p>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...aiSlots,...designSlots].map(s=><label key={s.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
    <input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id))}/>
    <div className="min-w-0"><p className="truncate text-sm font-medium">{s.current?.filename??"Нет файла"}</p><p className="text-xs text-muted-foreground">{ASSET_KIND_LABELS[s.kind]} · {REVIEW_STATE_LABELS[s.review_state]}</p></div>
    {s.current&&<Button size="sm" variant="outline" onClick={e=>{e.preventDefault();openAsset(s)}}>Открыть</Button>}
   </label>)}</div>
   <h3 className="font-semibold">История отклонений</h3>
   {(rejects.data??[]).map(r=><p key={r.id} className="rounded-lg border p-3 text-sm">Цикл {r.cycle} · {r.stage==="design"?"Дизайн":"AI"} · {r.reason} {r.comment&&"— "+r.comment}</p>)}
  </div>}
  {tab==="results"&&<div className="space-y-4">
   <section className="rounded-xl border bg-card p-5 space-y-2"><h3 className="font-semibold">Тестирование</h3>
    {(tests.data??[]).map(r=><div key={r.id} className="text-sm">Лучший CTR: <b>{r.ctr_best}%</b>; худший CTR: <b>{r.ctr_worst}%</b>; используется: {r.used_main?"Да":"Нет"}. {r.notes}</div>)}
    {!tests.data?.length&&<p className="text-sm text-muted-foreground">Результаты ещё не записаны.</p>}
   </section>
   <section className="rounded-xl border bg-card p-5 space-y-2"><h3 className="font-semibold">Дизайн</h3>
   {(design.data??[]).map(r=><div key={r.id} className="text-sm">Цикл {r.cycle}: {r.canva_url?<a href={r.canva_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Открыть Canva</a>:"Без ссылки"} · {r.notes}</div>)}
   {!design.data?.length&&<p className="text-sm text-muted-foreground">Дизайн ещё не отправлен.</p>}
   </section></div>}
  {tab==="comments"&&canDiscuss&&<div className="space-y-3">
   {(comments.data??[]).map(c=><div key={c.id} className="rounded-lg border bg-card p-3 text-sm"><p className="text-xs text-muted-foreground">{detail.profiles.map.get(c.author_id??"")?.full_name??"Сотрудник"} · {fmtDateTime(c.created_at)}</p><p className="whitespace-pre-wrap">{c.body}</p></div>)}
   {task.status!=="completed"&&task.status!=="cancelled"&&<div className="space-y-2"><Textarea placeholder="Написать комментарий производственному отделу…" value={comment} onChange={e=>setComment(e.target.value)}/><Button disabled={busyComment||!comment.trim()} onClick={submitComment}>Отправить</Button></div>}
  </div>}
  {tab==="history"&&<div className="space-y-2">
   {(events.data??[]).map(e=><details key={e.id} className="rounded-lg border bg-card p-3"><summary className="cursor-pointer text-sm"><History className="inline size-3"/> {ACTION_LABELS[e.action]??e.action} · {fmtDateTime(e.created_at)}</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(e.details,null,2)}</pre></details>)}
   {!events.data?.length&&<EmptyState title="История пуста или недоступна"/>}
  </div>}
  <UploadQueueList items={tab==="materials"?[]:uploads.items}/>
  <CommandDialog open={!!active} onOpenChange={o=>{if(!o)setActive(null)}} title={active?actionNames[active]:"Действие"} fields={active?actionFields(active,task,detail.profiles.list):[]} onSubmit={confirm} destructive={active==="cancel"||active==="reject_ai"||active==="reject_design"}>
   {(active==="reject_ai"||active==="reject_design")&&<div className="space-y-2"><p className="text-sm">Выберите изображения для доработки:</p>{choices.map(s=><label className="flex items-center gap-2 text-sm" key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id))}/>{s.current?.filename??`Фото #${s.slot_number}`}</label>)}</div>}
  </CommandDialog>
  {preview&&<div role="dialog" aria-label="Просмотр изображения" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-6" onClick={()=>setPreview(null)}><Button onClick={()=>setPreview(null)}>Закрыть</Button><img src={preview} alt="Материал заявки" className="max-h-[82vh] max-w-full object-contain"/></div>}
 </div>;
}

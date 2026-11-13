import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Zap } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtDate, isOverdue } from "@/lib/format";
import { needsMyAction } from "@/lib/permissions";
import type { Profile, Task } from "@/lib/types";
import { DeadlineLabel, PersonChip, PriorityBadge, StatusBadge } from "@/components/common";

type SortKey = "number" | "deadline_at" | "created_at" | "priority";
const PRIORITY_RANK = { High: 3, Medium: 2, Low: 1 } as const;

export function TaskTable({ tasks, me }: { tasks: Task[]; me: Profile }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "number", dir: -1 });

  const sorted = useMemo(() => {
    const val = (t: Task): number => {
      if (sort.key === "number") return t.number;
      if (sort.key === "priority") return PRIORITY_RANK[t.priority] ?? 0;
      const v = t[sort.key];
      return v ? new Date(v).getTime() : Number.MAX_SAFE_INTEGER;
    };
    return [...tasks].sort((a, b) => (val(a) - val(b)) * sort.dir);
  }, [tasks, sort]);

  const Th = ({ k, children, className }: { k?: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={cn("whitespace-nowrap text-xs", className)}>
      {k ? (
        <button
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => setSort((s) => ({ key: k!, dir: s.key === k ? ((-s.dir) as 1 | -1) : -1 }))}
        >
          {children}
          {sort.key === k && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </button>
      ) : (
        children
      )}
    </TableHead>
  );

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <Th k="number">№</Th>
            <Th>Категория</Th>
            <Th>LD артикул</Th>
            <Th>Статус</Th>
            <Th k="priority">Приоритет</Th>
            <Th>Инициатор</Th>
            <Th>Исполнитель</Th>
            <Th k="deadline_at">Дедлайн</Th>
            <Th k="created_at">Создана</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((t) => {
            const executor = t.status.startsWith("design") ? t.designer : t.status === "stylist" ? t.stylist : t.creator;
            return (
              <TableRow
                key={t.id}
                className={cn("cursor-pointer", isOverdue(t) && "bg-tone-danger/5")}
                onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: t.id } })}
              >
                <TableCell className="font-mono text-xs">
                  <span className="inline-flex items-center gap-1">
                    {t.number}
                    {needsMyAction(t, me) && <Zap className="size-3 text-primary" />}
                  </span>
                </TableCell>
                <TableCell className="max-w-48 truncate text-sm">{t.category?.name ?? "—"}</TableCell>
                <TableCell className="text-sm font-medium">{t.ld_article || "—"}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                <TableCell className="max-w-44 text-sm"><PersonChip person={t.initiator} /></TableCell>
                <TableCell className="max-w-44 text-sm"><PersonChip person={executor ?? t.creator} /></TableCell>
                <TableCell className="whitespace-nowrap text-xs"><DeadlineLabel task={t} /></TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(t.created_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchCategories,
  fetchProfiles,
  fetchTask,
  fetchTasks,
  hydrateTask,
  qk,
  runTaskAction,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Category, Profile, TaskAction } from "@/lib/types";

export function useProfiles() {
  const q = useQuery({ queryKey: qk.profiles, queryFn: fetchProfiles, staleTime: 60_000 });
  const map = useMemo(() => new Map<string, Profile>((q.data ?? []).map((p) => [p.id, p])), [q.data]);
  return { ...q, list: q.data ?? [], map };
}

export function useCategories() {
  const q = useQuery({ queryKey: qk.categories, queryFn: fetchCategories, staleTime: 60_000 });
  const map = useMemo(
    () => new Map<string, Category>((q.data ?? []).map((c) => [c.id, c])),
    [q.data],
  );
  return { ...q, list: q.data ?? [], map };
}

export function useTasks() {
  const profiles = useProfiles();
  const categories = useCategories();
  const q = useQuery({ queryKey: qk.tasks, queryFn: fetchTasks, staleTime: 15_000 });
  const tasks = useMemo(
    () => (q.data ?? []).map((t) => hydrateTask(t, profiles.map, categories.map)),
    [q.data, profiles.map, categories.map],
  );
  return { ...q, tasks, profiles, categories };
}

export function useTask(id: string) {
  const profiles = useProfiles();
  const categories = useCategories();
  const q = useQuery({ queryKey: qk.task(id), queryFn: () => fetchTask(id) });
  const task = useMemo(
    () => (q.data ? hydrateTask(q.data, profiles.map, categories.map) : null),
    [q.data, profiles.map, categories.map],
  );
  return { ...q, task, profiles, categories };
}

/** Invalidate queries when rows change (works when Realtime is enabled for the table). */
export function useRealtimeInvalidate(
  channel: string,
  table: string,
  keys: readonly (readonly unknown[])[],
  filter?: string,
) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(channel)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => keys.forEach((k) => qc.invalidateQueries({ queryKey: k })),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, table, filter, qc]);
}

export function useInvalidateTask(taskId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.task(taskId) });
    qc.invalidateQueries({ queryKey: qk.tasks });
  };
}

export function useTaskAction(taskId: string) {
  const invalidate = useInvalidateTask(taskId);
  return useMutation({
    mutationFn: (args: { action: TaskAction; payload?: Record<string, unknown>; success?: string }) =>
      runTaskAction(taskId, args.action, args.payload ?? {}),
    onSuccess: (_d, args) => {
      toast.success(args.success ?? "Готово");
      invalidate();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      invalidate();
    },
  });
}
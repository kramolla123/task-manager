import { useQuery } from "@tanstack/react-query";
import {
  fetchComments,
  fetchDesignSubmissions,
  fetchEvents,
  fetchRejections,
  fetchSlots,
  fetchTestResults,
  qk,
} from "@/lib/api";

export const useSlots = (id: string) =>
  useQuery({ queryKey: qk.taskPart(id, "slots"), queryFn: () => fetchSlots(id) });
export const useEvents = (id: string) =>
  useQuery({ queryKey: qk.taskPart(id, "events"), queryFn: () => fetchEvents(id) });
export const useRejections = (id: string) =>
  useQuery({ queryKey: qk.taskPart(id, "rejections"), queryFn: () => fetchRejections(id) });
export const useTestResults = (id: string) =>
  useQuery({ queryKey: qk.taskPart(id, "test_results"), queryFn: () => fetchTestResults(id) });
export const useDesignSubmissions = (id: string) =>
  useQuery({ queryKey: qk.taskPart(id, "design"), queryFn: () => fetchDesignSubmissions(id) });
export const useComments = (id: string, enabled = true) =>
  useQuery({ queryKey: qk.taskPart(id, "comments"), queryFn: () => fetchComments(id), enabled });
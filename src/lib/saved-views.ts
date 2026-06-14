import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FilterGroup } from "@/lib/filters";

export type SavedView = {
  id: string;
  owner_id: string;
  entity: string;
  name: string;
  is_shared: boolean;
  is_default: boolean;
  filters: FilterGroup;
  quick_filters: unknown[];
  column_order: string[] | null;
  sort_by: string | null;
  sort_dir: "asc" | "desc" | null;
};

export type PresetView = {
  id: string; // local id, prefixed "preset:"
  name: string;
  filters: FilterGroup;
  column_order?: string[];
  sort_by?: string;
  sort_dir?: "asc" | "desc";
};

export function useSavedViews(entity: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["saved_views", entity],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("saved_views")
        .select("*")
        .eq("entity", entity)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SavedView[];
    },
  });
  const create = useMutation({
    mutationFn: async (input: Partial<SavedView>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("saved_views")
        .insert({ ...input, entity })
        .select("*")
        .single();
      if (error) throw error;
      return data as SavedView;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved_views", entity] }),
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SavedView> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("saved_views").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved_views", entity] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("saved_views").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved_views", entity] }),
  });
  return { ...query, create, update, remove };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type FamilyRole = "admin" | "member" | "viewer";

export type Membership = {
  family_id: string;
  role: FamilyRole;
  families: { id: string; name: string; currency: string; emergency_fund_target: number } | null;
};

export function useMemberships() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("family_id, role, families(id, name, currency, emergency_fund_target)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });
}

/** Active family = first membership (families are small; one per user in practice). */
export function useFamily() {
  const { data, isLoading, error } = useMemberships();
  const active = data?.[0] ?? null;
  return {
    familyId: active?.family_id ?? null,
    family: active?.families ?? null,
    role: (active?.role ?? null) as FamilyRole | null,
    canWrite: active?.role === "admin" || active?.role === "member",
    isAdmin: active?.role === "admin",
    isLoading,
    error,
  };
}

export type FamilyMember = {
  id: string;
  user_id: string;
  role: FamilyRole;
  created_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    whatsapp: string | null;
  } | null;
};

export function useFamilyMembers(familyId: string | null) {
  return useQuery<FamilyMember[]>({
    queryKey: ["family-members", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("id, user_id, role, created_at")
        .eq("family_id", familyId!);
      if (error) throw error;
      const ids = (data ?? []).map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, whatsapp")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (data ?? []).map((m) => ({
        ...m,
        profile: profiles?.find((p) => p.id === m.user_id) ?? null,
      })) as FamilyMember[];
    },
  });
}

export function useCategories(familyId: string | null) {
  return useQuery({
    queryKey: ["categories", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("family_id", familyId!)
        .order("kind")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTransactions(familyId: string | null) {
  return useQuery({
    queryKey: ["transactions", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("family_id", familyId!)
        .order("tx_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBills(familyId: string | null) {
  return useQuery({
    queryKey: ["bills", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .eq("family_id", familyId!)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGoals(familyId: string | null) {
  return useQuery({
    queryKey: ["goals", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("family_id", familyId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvestments(familyId: string | null) {
  return useQuery({
    queryKey: ["investments", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investments")
        .select("*")
        .eq("family_id", familyId!)
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCards(familyId: string | null) {
  return useQuery({
    queryKey: ["credit-cards", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("family_id", familyId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMonthTransactions(familyId: string | null, month: string) {
  return useQuery({
    queryKey: ["month-transactions", familyId, month],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("family_transactions_for_month", {
        p_family_id: familyId!,
        p_month: `${month}-01`,
      });
      if (error) throw error;
      return (data ?? []) as unknown as import("@/lib/finance").MonthTransaction[];
    },
  });
}

export type Invitation = {
  id: string;
  email: string;
  role: FamilyRole;
  token: string;
  expires_at: string;
  status: string;
  invited_by: string;
};

export function useInvitations(familyId: string | null) {
  return useQuery({
    queryKey: ["invitations", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, token, expires_at, status, invited_by")
        .eq("family_id", familyId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Invitation[];
    },
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: FamilyRole }) => {
      const { error } = await supabase.from("family_members").update({ role }).eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["family-members"] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("family_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["family-members"] }),
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      familyId,
      email,
      role,
    }: {
      familyId: string;
      email: string;
      role: FamilyRole;
    }) => {
      const { data, error } = await supabase.rpc("create_family_invite", {
        p_family_id: familyId,
        p_email: email,
        p_role: role,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.rpc("revoke_family_invite", { p_invite_id: inviteId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

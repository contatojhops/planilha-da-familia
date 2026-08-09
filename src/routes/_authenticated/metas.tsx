import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/finance-ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFamily, useFamilyMembers, useGoals } from "@/hooks/useFamily";
import { CATEGORY_COLORS, ICON_NAMES, categoryIcon } from "@/lib/category-icons";
import { formatDate, money, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({
    meta: [
      { title: "Metas da família — Casa Clara" },
      { name: "description", content: "Metas do núcleo familiar no Casa Clara, com dados compartilhados entre os membros da família." },
      { property: "og:title", content: "Metas da família — Casa Clara" },
      { property: "og:description", content: "Metas do núcleo familiar no Casa Clara." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type GoalProgress = {
  goal_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  progress_percent: number | null;
  target_date: string | null;
  monthly_pace: number | null;
  projected_completion_date: string | null;
};

const emptyForm = {
  id: "",
  name: "",
  icon: "piggy-bank",
  color: CATEGORY_COLORS[0]!,
  target_amount: "",
  target_date: "",
  auto_save_percent: "",
};

function Page() {
  const { user } = useAuth();
  const { familyId, canWrite, isAdmin } = useFamily();
  const qc = useQueryClient();
  const { data: goals = [] } = useGoals(familyId);
  const { data: members = [] } = useFamilyMembers(familyId);

  const progress = useQuery({
    queryKey: ["goals-progress", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("goals_with_progress", {
        p_family_id: familyId!,
      });
      if (error) throw error;
      return (data ?? []) as unknown as GoalProgress[];
    },
  });

  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [contribGoal, setContribGoal] = useState<{ id: string; name: string } | null>(null);
  const [contrib, setContrib] = useState({ amount: "", member: "none", date: todayISO() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["goals", familyId] });
    qc.invalidateQueries({ queryKey: ["goals-progress", familyId] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        icon: form.icon,
        color: form.color,
        target_amount: Number(form.target_amount || 0),
        target_date: form.target_date || null,
        auto_save_percent: Number(form.auto_save_percent || 0),
      };
      if (!payload.name) throw new Error("Informe o nome da meta");
      if (form.id) {
        const { error } = await supabase.from("goals").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("goals")
          .insert({ ...payload, family_id: familyId!, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setForm(emptyForm);
      toast.success("Meta salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contribute = useMutation({
    mutationFn: async () => {
      const amount = Number(contrib.amount || 0);
      if (amount <= 0) throw new Error("Informe um valor válido");
      const { error } = await supabase.from("goal_contributions").insert({
        goal_id: contribGoal!.id,
        family_id: familyId!,
        amount,
        contributed_at: contrib.date,
        created_by: contrib.member === "none" ? user!.id : contrib.member,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setContribGoal(null);
      setContrib({ amount: "", member: "none", date: todayISO() });
      toast.success("Aporte registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Meta excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = goals.map((g) => {
    const p = progress.data?.find((x) => x.goal_id === g.id);
    return { goal: g, p };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Metas"
        description="Objetivos da família com progresso e projeção calculados no banco."
        actions={
          canWrite && (
            <Button
              onClick={() => {
                setForm(emptyForm);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" /> Nova meta
            </Button>
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhuma meta cadastrada"
          description="Crie a primeira meta da família para acompanhar o progresso dos aportes."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ goal, p }) => {
            const Icon = categoryIcon(goal.icon);
            const percent = Number(p?.progress_percent ?? 0);
            const late =
              !!p?.projected_completion_date &&
              !!p?.target_date &&
              p.projected_completion_date > p.target_date;
            return (
              <Card key={goal.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex size-9 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${goal.color}22`, color: goal.color }}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div>
                        <p className="font-medium leading-tight">{goal.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Alvo: {formatDate(goal.target_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {canWrite && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Editar meta"
                          onClick={() => {
                            setForm({
                              id: goal.id,
                              name: goal.name,
                              icon: goal.icon ?? "piggy-bank",
                              color: goal.color ?? CATEGORY_COLORS[0]!,
                              target_amount: String(goal.target_amount ?? ""),
                              target_date: goal.target_date ?? "",
                              auto_save_percent: String(goal.auto_save_percent ?? ""),
                            });
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Excluir meta"
                          onClick={() => remove.mutate(goal.id)}
                        >
                          <Trash2 className="size-4 text-negative" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Progress value={Math.min(100, percent)} />
                    <div className="flex items-center justify-between text-xs">
                      <span className="num text-muted-foreground">
                        {money(p?.current_amount ?? goal.current_amount)} de{" "}
                        {money(p?.target_amount ?? goal.target_amount)}
                      </span>
                      <Badge variant="secondary" className="num">
                        {percent.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>

                  <p
                    className={cn(
                      "text-xs",
                      late ? "text-warning" : "text-muted-foreground",
                    )}
                  >
                    {p?.projected_completion_date
                      ? late
                        ? `No ritmo atual, conclusão em ${formatDate(p.projected_completion_date)} — depois da data-alvo`
                        : `Conclusão projetada: ${formatDate(p.projected_completion_date)}`
                      : "Ainda sem aportes registrados"}
                  </p>

                  {canWrite && (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => setContribGoal({ id: goal.id, name: goal.name })}
                    >
                      <Target className="size-4" /> Aportar
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar meta" : "Nova meta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Reserva de emergência"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor-alvo</Label>
                <Input
                  inputMode="decimal"
                  value={form.target_amount}
                  onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                />
              </div>
              <div>
                <Label>Data-alvo</Label>
                <Input
                  type="date"
                  value={form.target_date}
                  onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Guardar automaticamente (% da renda)</Label>
              <Input
                inputMode="decimal"
                value={form.auto_save_percent}
                onChange={(e) => setForm({ ...form, auto_save_percent: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label>Ícone</Label>
              <div className="mt-1 grid max-h-32 grid-cols-8 gap-1 overflow-y-auto rounded-md border p-2">
                {ICON_NAMES.map((name) => {
                  const Ico = categoryIcon(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-label={name}
                      onClick={() => setForm({ ...form, icon: name })}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md",
                        form.icon === name ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      <Ico className="size-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Cor</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => setForm({ ...form, color: c })}
                    className={cn(
                      "size-6 rounded-full border-2",
                      form.color === c ? "border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contribGoal} onOpenChange={(o) => !o && setContribGoal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aportar em {contribGoal?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor</Label>
              <Input
                inputMode="decimal"
                value={contrib.amount}
                onChange={(e) => setContrib({ ...contrib, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={contrib.date}
                onChange={(e) => setContrib({ ...contrib, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Responsável</Label>
              <Select
                value={contrib.member}
                onValueChange={(v) => setContrib({ ...contrib, member: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Eu</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profile?.full_name || m.profile?.email || "Membro"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => contribute.mutate()} disabled={contribute.isPending}>
              Registrar aporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

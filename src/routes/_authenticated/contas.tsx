import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader, StatCard } from "@/components/finance-ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBills, useCategories, useFamily, useFamilyMembers } from "@/hooks/useFamily";
import { BILL_STATUS_LABELS, RECURRENCE_LABELS } from "@/lib/finance";
import { formatDate, money, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/contas")({
  head: () => ({
    meta: [
      { title: "Contas a pagar e receber — Casa Clara" },
      {
        name: "description",
        content:
          "Controle vencimentos da família, marque contas como pagas e receba alertas antes do prazo.",
      },
      { property: "og:title", content: "Contas a pagar e receber — Casa Clara" },
      { property: "og:description", content: "Vencimentos, atrasos e baixa de contas da família." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contas,
});

function daysUntil(date: string) {
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86400000);
}

function Contas() {
  const { user } = useAuth();
  const { familyId, canWrite } = useFamily();
  const qc = useQueryClient();
  const { data: bills = [] } = useBills(familyId);
  const { data: categories = [] } = useCategories(familyId);
  const { data: members = [] } = useFamilyMembers(familyId);

  const [tab, setTab] = useState("open");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    due_date: todayISO(),
    recurrence: "monthly",
    category_id: "none",
    owner_id: "none",
    notes: "",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["bills", familyId] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bills").insert({
        family_id: familyId!,
        created_by: user!.id,
        name: form.name,
        amount: Number(form.amount || 0),
        due_date: form.due_date,
        recurrence: form.recurrence as "monthly",
        category_id: form.category_id === "none" ? null : form.category_id,
        owner_id: form.owner_id === "none" ? null : form.owner_id,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setForm({ ...form, name: "", amount: "", notes: "" });
      toast.success("Conta cadastrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: async (bill: { id: string; status: string }) => {
      const paid = bill.status === "paid";
      const { error } = await supabase
        .from("bills")
        .update({ status: paid ? "pending" : "paid", paid_at: paid ? null : todayISO() })
        .eq("id", bill.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const overdue = bills.filter((b) => b.status !== "paid" && daysUntil(b.due_date) < 0);
  const dueSoon = bills.filter(
    (b) => b.status !== "paid" && daysUntil(b.due_date) >= 0 && daysUntil(b.due_date) <= 7,
  );
  const totalOpen = bills
    .filter((b) => b.status !== "paid")
    .reduce((s, b) => s + Number(b.amount), 0);

  const list = useMemo(() => {
    const arr =
      tab === "open"
        ? bills.filter((b) => b.status !== "paid")
        : tab === "paid"
          ? bills.filter((b) => b.status === "paid")
          : bills;
    return [...arr].sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [bills, tab]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contas a pagar e receber"
        description="Vencimentos da família, com alertas automáticos por WhatsApp"
        actions={
          canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" /> Nova conta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova conta</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label>Nome</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ex.: Energia elétrica"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Valor</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Vencimento</Label>
                      <Input
                        type="date"
                        value={form.due_date}
                        onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Recorrência</Label>
                      <Select
                        value={form.recurrence}
                        onValueChange={(v) => setForm({ ...form, recurrence: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Categoria</Label>
                      <Select
                        value={form.category_id}
                        onValueChange={(v) => setForm({ ...form, category_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem categoria</SelectItem>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Responsável</Label>
                    <Select
                      value={form.owner_id}
                      onValueChange={(v) => setForm({ ...form, owner_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
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
                  <Button
                    onClick={() => create.mutate()}
                    disabled={!form.name || create.isPending}
                  >
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total em aberto" value={money(totalOpen)} icon={CalendarClock} />
        <StatCard
          label="Vencendo em 7 dias"
          value={String(dueSoon.length)}
          tone={dueSoon.length ? "negative" : "neutral"}
        />
        <StatCard
          label="Em atraso"
          value={String(overdue.length)}
          tone={overdue.length ? "negative" : "positive"}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="open">Em aberto</TabsTrigger>
          <TabsTrigger value="paid">Pagas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{list.length} conta(s)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <EmptyState title="Nenhuma conta aqui" />}
          {list.map((b) => {
            const d = daysUntil(b.due_date);
            const late = b.status !== "paid" && d < 0;
            return (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(b.due_date)} ·{" "}
                    {b.status === "paid"
                      ? BILL_STATUS_LABELS.paid
                      : late
                        ? `${Math.abs(d)} dia(s) em atraso`
                        : `em ${d} dia(s)`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      b.status === "paid" ? "secondary" : late ? "destructive" : "outline"
                    }
                  >
                    {late ? BILL_STATUS_LABELS.overdue : BILL_STATUS_LABELS[b.status]}
                  </Badge>
                  <span className="num text-sm font-semibold">{money(b.amount)}</span>
                  {canWrite && (
                    <>
                      <Button
                        variant={b.status === "paid" ? "outline" : "default"}
                        size="sm"
                        onClick={() => pay.mutate(b)}
                      >
                        <Check className="size-4" />
                        {b.status === "paid" ? "Reabrir" : "Pagar"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-negative"
                        aria-label="Excluir conta"
                        onClick={() => remove.mutate(b.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

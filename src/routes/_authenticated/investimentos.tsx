import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Trash2, TrendingUp, Wallet } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatCard } from "@/components/finance-ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFamily, useFamilyMembers, useInvestments } from "@/hooks/useFamily";
import { ASSET_LABELS } from "@/lib/finance";
import { CATEGORY_COLORS } from "@/lib/category-icons";
import { formatDate, money, shortMoney, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/investimentos")({
  head: () => ({
    meta: [
      { title: "Investimentos da família — Casa Clara" },
      { name: "description", content: "Investimentos do núcleo familiar no Casa Clara, com dados compartilhados entre os membros da família." },
      { property: "og:title", content: "Investimentos da família — Casa Clara" },
      { property: "og:description", content: "Investimentos do núcleo familiar no Casa Clara." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type Allocation = { asset_class: string; total_value: number; percent: number };

const ASSET_CLASSES = Object.keys(ASSET_LABELS);

const emptyForm = {
  id: "",
  name: "",
  asset_class: "fixed_income",
  invested_amount: "",
  current_value: "",
  purchase_date: todayISO(),
  owner_id: "none",
};

function Page() {
  const { user } = useAuth();
  const { familyId, canWrite, isAdmin } = useFamily();
  const qc = useQueryClient();
  const { data: investments = [] } = useInvestments(familyId);
  const { data: members = [] } = useFamilyMembers(familyId);

  const snapshots = useQuery({
    queryKey: ["net-worth-snapshots", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("net_worth_snapshots")
        .select("snapshot_date, cash_balance, investments_value, debts_value, net_worth")
        .eq("family_id", familyId!)
        .order("snapshot_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const allocation = useQuery({
    queryKey: ["portfolio-allocation", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("portfolio_allocation", {
        p_family_id: familyId!,
      });
      if (error) throw error;
      return (data ?? []) as unknown as Allocation[];
    },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [valueTarget, setValueTarget] = useState<{ id: string; name: string } | null>(null);
  const [newValue, setNewValue] = useState({ value: "", date: todayISO() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["investments", familyId] });
    qc.invalidateQueries({ queryKey: ["portfolio-allocation", familyId] });
    qc.invalidateQueries({ queryKey: ["net-worth-snapshots", familyId] });
  };

  const totals = useMemo(() => {
    const invested = investments.reduce((s, i) => s + Number(i.invested_amount ?? 0), 0);
    const current = investments.reduce((s, i) => s + Number(i.current_value ?? 0), 0);
    const last = snapshots.data?.[snapshots.data.length - 1];
    return {
      invested,
      current,
      netWorth: Number(last?.net_worth ?? current),
      gain: invested > 0 ? ((current - invested) / invested) * 100 : 0,
    };
  }, [investments, snapshots.data]);

  const chartData = (snapshots.data ?? []).map((s) => ({
    date: formatDate(s.snapshot_date),
    net_worth: Number(s.net_worth),
    cash_balance: Number(s.cash_balance),
    investments_value: Number(s.investments_value),
    debts_value: Number(s.debts_value),
  }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        asset_class: form.asset_class as "fixed_income",
        invested_amount: Number(form.invested_amount || 0),
        current_value: Number(form.current_value || form.invested_amount || 0),
        purchase_date: form.purchase_date,
        owner_id: form.owner_id === "none" ? null : form.owner_id,
      };
      if (!payload.name) throw new Error("Informe o nome do investimento");
      if (form.id) {
        const { error } = await supabase.from("investments").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("investments")
          .insert({ ...payload, family_id: familyId!, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setForm(emptyForm);
      toast.success("Investimento salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordValue = useMutation({
    mutationFn: async () => {
      const value = Number(newValue.value || 0);
      if (value <= 0) throw new Error("Informe um valor válido");
      const { error } = await supabase.from("investment_value_history").insert({
        investment_id: valueTarget!.id,
        family_id: familyId!,
        value,
        recorded_at: newValue.date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setValueTarget(null);
      setNewValue({ value: "", date: todayISO() });
      toast.success("Valor atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Investimento excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const memberName = (id: string | null) => {
    if (!id) return "Família";
    const m = members.find((x) => x.user_id === id);
    return m?.profile?.full_name || m?.profile?.email || "Membro";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Investimentos"
        description="Carteira da família, evolução patrimonial e distribuição por classe de ativo."
        actions={
          canWrite && (
            <Button
              onClick={() => {
                setForm(emptyForm);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" /> Novo investimento
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Patrimônio líquido" value={money(totals.netWorth)} icon={Wallet} />
        <StatCard label="Total investido" value={money(totals.invested)} />
        <StatCard
          label="Valor atual da carteira"
          value={money(totals.current)}
          hint={`${totals.gain >= 0 ? "+" : ""}${totals.gain.toFixed(2)}% sobre o investido`}
          tone={totals.gain >= 0 ? "positive" : "negative"}
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Evolução patrimonial</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum snapshot registrado ainda. O histórico é capturado mensalmente.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => shortMoney(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Line type="monotone" dataKey="net_worth" name="Patrimônio" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cash_balance" name="Caixa" stroke="var(--color-positive)" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="investments_value" name="Investimentos" stroke="var(--color-warning)" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="debts_value" name="Dívidas" stroke="var(--color-negative)" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Distribuição da carteira</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {(allocation.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem investimentos cadastrados.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(allocation.data ?? []).map((a) => ({
                      name: ASSET_LABELS[a.asset_class] ?? a.asset_class,
                      value: Number(a.total_value),
                      percent: Number(a.percent),
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    label={(e: { percent?: number }) => `${Number(e.percent ?? 0).toFixed(0)}%`}
                  >
                    {(allocation.data ?? []).map((a, i) => (
                      <Cell key={a.asset_class} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meus investimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {investments.length === 0 ? (
            <EmptyState
              title="Nenhum investimento"
              description="Cadastre o primeiro ativo da carteira da família."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead className="text-right">Investido</TableHead>
                    <TableHead className="text-right">Atual</TableHead>
                    <TableHead className="text-right">Ganho/Perda</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map((inv) => {
                    const invested = Number(inv.invested_amount ?? 0);
                    const current = Number(inv.current_value ?? 0);
                    const pct = invested > 0 ? ((current - invested) / invested) * 100 : 0;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {formatDate(inv.purchase_date)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {ASSET_LABELS[inv.asset_class] ?? inv.asset_class}
                          </Badge>
                        </TableCell>
                        <TableCell className="num text-right">{money(invested)}</TableCell>
                        <TableCell className="num text-right">{money(current)}</TableCell>
                        <TableCell
                          className={cn(
                            "num text-right",
                            pct >= 0 ? "text-positive" : "text-negative",
                          )}
                        >
                          {pct >= 0 ? "+" : ""}
                          {pct.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {memberName(inv.owner_id)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {canWrite && (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setValueTarget({ id: inv.id, name: inv.name })}
                                >
                                  <RefreshCw className="size-3.5" /> Atualizar valor
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Editar investimento"
                                  onClick={() => {
                                    setForm({
                                      id: inv.id,
                                      name: inv.name,
                                      asset_class: inv.asset_class,
                                      invested_amount: String(inv.invested_amount ?? ""),
                                      current_value: String(inv.current_value ?? ""),
                                      purchase_date: inv.purchase_date,
                                      owner_id: inv.owner_id ?? "none",
                                    });
                                    setFormOpen(true);
                                  }}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              </>
                            )}
                            {isAdmin && (
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Excluir investimento"
                                onClick={() => remove.mutate(inv.id)}
                              >
                                <Trash2 className="size-4 text-negative" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar investimento" : "Novo investimento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Tesouro Selic 2029"
              />
            </div>
            <div>
              <Label>Classe do ativo</Label>
              <Select
                value={form.asset_class}
                onValueChange={(v) => setForm({ ...form, asset_class: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {ASSET_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor investido</Label>
                <Input
                  inputMode="decimal"
                  value={form.invested_amount}
                  onChange={(e) => setForm({ ...form, invested_amount: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor atual</Label>
                <Input
                  inputMode="decimal"
                  value={form.current_value}
                  onChange={(e) => setForm({ ...form, current_value: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de aquisição</Label>
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Responsável</Label>
                <Select
                  value={form.owner_id}
                  onValueChange={(v) => setForm({ ...form, owner_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Família</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profile?.full_name || m.profile?.email || "Membro"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      <Dialog open={!!valueTarget} onOpenChange={(o) => !o && setValueTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar valor — {valueTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor atual</Label>
              <Input
                inputMode="decimal"
                value={newValue.value}
                onChange={(e) => setNewValue({ ...newValue, value: e.target.value })}
              />
            </div>
            <div>
              <Label>Data da cotação</Label>
              <Input
                type="date"
                value={newValue.date}
                onChange={(e) => setNewValue({ ...newValue, date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => recordValue.mutate()} disabled={recordValue.isPending}>
              Registrar valor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

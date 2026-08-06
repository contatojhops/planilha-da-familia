import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, MonthTimeline, PageHeader, StatCard } from "@/components/finance-ui";
import {
  useBills,
  useCategories,
  useFamily,
  useFamilyMembers,
  useGoals,
  useInvestments,
  useTransactions,
} from "@/hooks/useFamily";
import { buildProjection, expandOccurrences, monthWindow, type Tx } from "@/lib/finance";
import { formatDate, money, monthLabel, monthLongLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Dashboard financeiro da família — Casa Clara" },
      {
        name: "description",
        content:
          "Saldo do mês, projeção de 12 meses com semáforo, gastos por categoria e patrimônio líquido da família.",
      },
      { property: "og:title", content: "Dashboard financeiro da família — Casa Clara" },
      { property: "og:description", content: "Visão consolidada do fluxo de caixa da família." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { familyId, family } = useFamily();
  const { data: txs = [], isLoading } = useTransactions(familyId);
  const { data: categories = [] } = useCategories(familyId);
  const { data: bills = [] } = useBills(familyId);
  const { data: investments = [] } = useInvestments(familyId);
  const { data: goals = [] } = useGoals(familyId);
  const { data: members = [] } = useFamilyMembers(familyId);

  const [memberFilter, setMemberFilter] = useState("all");
  const months = useMemo(() => monthWindow(12), []);
  const currentMonth = months[0]!;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const filtered = useMemo(
    () =>
      (memberFilter === "all"
        ? txs
        : txs.filter((t) => t.owner_id === memberFilter || t.created_by === memberFilter)) as Tx[],
    [txs, memberFilter],
  );

  const occurrences = useMemo(() => expandOccurrences(filtered, months), [filtered, months]);
  const projection = useMemo(() => buildProjection(occurrences, months), [occurrences, months]);
  const selected = projection.find((p) => p.key === selectedMonth) ?? projection[0]!;

  const monthOccurrences = occurrences.filter((o) => o.occurrenceMonth === selectedMonth);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; color: string; value: number }>();
    for (const occ of monthOccurrences) {
      if (occ.type !== "expense") continue;
      const cat = categories.find((c) => c.id === occ.category_id);
      const key = cat?.id ?? "none";
      const prev = map.get(key);
      map.set(key, {
        name: cat?.name ?? "Sem categoria",
        color: cat?.color ?? "#94a3b8",
        value: (prev?.value ?? 0) + occ.amountNum,
      });
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [monthOccurrences, categories]);

  const topExpenses = [...monthOccurrences]
    .filter((o) => o.type === "expense")
    .sort((a, b) => b.amountNum - a.amountNum)
    .slice(0, 5);

  const investTotal = investments.reduce((s, i) => s + Number(i.current_value), 0);
  const debtsTotal = monthOccurrences
    .filter((o) => o.type === "expense" && o.status === "planned")
    .reduce((s, o) => s + o.amountNum, 0);
  const goalsSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const netWorth = investTotal + goalsSaved + selected.cumulative;

  const fixedMonthly = useMemo(() => {
    const fixedIds = categories.filter((c) => c.kind === "fixed_expense").map((c) => c.id);
    return occurrences
      .filter(
        (o) =>
          o.occurrenceMonth === currentMonth &&
          o.type === "expense" &&
          o.category_id &&
          fixedIds.includes(o.category_id),
      )
      .reduce((s, o) => s + o.amountNum, 0);
  }, [occurrences, categories, currentMonth]);

  const emergencyMonths = fixedMonthly > 0 ? (goalsSaved + investTotal) / fixedMonthly : 0;

  const upcoming = bills
    .filter((b) => b.status !== "paid")
    .filter((b) => {
      const diff =
        (new Date(`${b.due_date}T00:00:00`).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return diff <= 30;
    })
    .slice(0, 6);

  const overdue = bills.filter(
    (b) => b.status !== "paid" && new Date(`${b.due_date}T00:00:00`) < new Date(),
  );

  const firstNegativeCumulative = projection.find((p) => p.cumulative < 0);

  const lineData = projection.map((p) => ({
    month: monthLabel(p.key),
    Receitas: p.income,
    Despesas: p.expense,
    Saldo: p.balance,
  }));

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando dados da família...</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${family?.name ?? "família"}`}
        description={`Visão consolidada · ${monthLongLabel(selectedMonth)}`}
        actions={
          <Select value={memberFilter} onValueChange={setMemberFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por membro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda a família</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.profile?.full_name || m.profile?.email || "Membro"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {firstNegativeCumulative && (
        <div className="flex items-start gap-3 rounded-lg border border-negative/40 bg-negative-soft p-4">
          <AlertTriangle className="mt-0.5 size-5 text-negative" />
          <div>
            <p className="text-sm font-semibold text-negative">
              Saldo acumulado fica negativo em {monthLongLabel(firstNegativeCumulative.key)}
            </p>
            <p className="text-sm text-muted-foreground">
              O efeito cascata dos meses anteriores leva o acumulado a{" "}
              {money(firstNegativeCumulative.cumulative)}. Reveja despesas previstas ou antecipe
              receitas.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Saldo do mês"
          value={money(selected.balance)}
          hint={`Acumulado: ${money(selected.cumulative)}`}
          tone={selected.balance < 0 ? "negative" : "positive"}
          icon={Wallet}
        />
        <StatCard
          label="Receitas"
          value={money(selected.income)}
          hint={`Realizadas: ${money(selected.incomeRealized)}`}
          icon={ArrowUpRight}
        />
        <StatCard
          label="Despesas"
          value={money(selected.expense)}
          hint={`A realizar: ${money(debtsTotal)}`}
          icon={ArrowDownRight}
        />
        <StatCard
          label="Patrimônio líquido"
          value={money(netWorth)}
          hint={`Investimentos: ${money(investTotal)}`}
          icon={PiggyBank}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Próximos 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthTimeline rows={projection} selected={selectedMonth} onSelect={setSelectedMonth} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Receitas x Despesas</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Receitas"
                  stroke="var(--color-positive)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Despesas"
                  stroke="var(--color-negative)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Saldo"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gasto por categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {byCategory.length === 0 ? (
              <EmptyState title="Sem despesas neste mês" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {byCategory.map((c) => (
                      <Cell key={c.name} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Maiores gastos do mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topExpenses.length === 0 && <EmptyState title="Nada lançado ainda" />}
            {topExpenses.map((t) => (
              <div key={`${t.id}-${t.occurrenceMonth}`} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {categories.find((c) => c.id === t.category_id)?.name ?? "Sem categoria"}
                  </p>
                </div>
                <span className="num text-sm font-semibold">{money(t.amountNum)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Próximos vencimentos</CardTitle>
            <Link to="/contas" className="text-xs font-medium text-primary underline">
              ver todos
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdue.length > 0 && (
              <Badge variant="destructive">{overdue.length} conta(s) em atraso</Badge>
            )}
            {upcoming.length === 0 && <EmptyState title="Nenhuma conta nos próximos 30 dias" />}
            {upcoming.map((b) => {
              const late = new Date(`${b.due_date}T00:00:00`) < new Date();
              return (
                <div key={b.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <p className={late ? "text-xs text-negative" : "text-xs text-muted-foreground"}>
                      vence {formatDate(b.due_date)}
                    </p>
                  </div>
                  <span className="num text-sm font-semibold">{money(b.amount)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reserva de emergência</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="num text-3xl font-semibold">{emergencyMonths.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">
              meses de despesas fixas cobertos ({money(fixedMonthly)}/mês)
            </p>
            <div className="mt-4 h-2 w-full rounded-full bg-secondary">
              <div
                className="h-2 rounded-full bg-positive"
                style={{ width: `${Math.min(100, (emergencyMonths / 6) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Objetivo saudável: 6 meses</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Saldo projetado por mês</CardTitle>
        </CardHeader>
        <CardContent className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projection.map((p) => ({ month: monthLabel(p.key), Saldo: p.balance }))}>
              <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(v) => money(Number(v))} />
              <Bar dataKey="Saldo" radius={[4, 4, 0, 0]}>
                {projection.map((p) => (
                  <Cell
                    key={p.key}
                    fill={p.balance < 0 ? "var(--color-negative)" : "var(--color-positive)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

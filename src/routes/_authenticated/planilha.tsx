import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MonthTimeline, PageHeader, StatCard } from "@/components/finance-ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useCategories,
  useFamily,
  useFamilyMembers,
  useMonthTransactions,
  useTransactions,
} from "@/hooks/useFamily";
import {
  PAYMENT_LABELS,
  RECURRENCE_LABELS,
  buildProjection,
  downloadCsv,
  expandOccurrences,
  monthWindow,
  type MonthTransaction,
  type Tx,
} from "@/lib/finance";
import { money, monthLongLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/planilha")({
  head: () => ({
    meta: [
      { title: "Planilha financeira da família — Casa Clara" },
      {
        name: "description",
        content:
          "Lance receitas e despesas em formato de planilha, com edição inline, recorrências, parcelamentos e status previsto ou realizado.",
      },
      { property: "og:title", content: "Planilha financeira da família — Casa Clara" },
      {
        property: "og:description",
        content: "Grid editável de receitas e despesas com projeção mensal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Planilha,
});

const PAYMENTS = Object.keys(PAYMENT_LABELS);
const RECURRENCES = Object.keys(RECURRENCE_LABELS);

function Planilha() {
  const { user } = useAuth();
  const { familyId, canWrite } = useFamily();
  const qc = useQueryClient();
  const { data: txs = [] } = useTransactions(familyId);
  const { data: categories = [] } = useCategories(familyId);
  const { data: members = [] } = useFamilyMembers(familyId);

  const months = useMemo(() => monthWindow(12), []);
  const [month, setMonth] = useState(months[0]!);

  const { data: rows = [], isLoading: rowsLoading } = useMonthTransactions(familyId, month);

  const occurrences = useMemo(() => expandOccurrences(txs as Tx[], months), [txs, months]);
  const projection = useMemo(() => buildProjection(occurrences, months), [occurrences, months]);
  const monthRow = projection.find((p) => p.key === month)!;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions", familyId] });
    qc.invalidateQueries({ queryKey: ["month-transactions", familyId, month] });
  };

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("transactions")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Lançamento excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });




  function exportCsv() {
    downloadCsv(
      `planilha-${month}.csv`,
      rows.map((r) => ({
        Data: r.display_date,
        Descrição: r.description,
        Tipo: r.type === "income" ? "Receita" : "Despesa",
        Categoria: categories.find((c) => c.id === r.category_id)?.name ?? "",
        Valor: Number(r.amount).toFixed(2).replace(".", ","),
        Status: r.status === "realized" ? "Realizado" : "Previsto",
        Recorrência: RECURRENCE_LABELS[r.recurrence] ?? "",
        Pagamento: PAYMENT_LABELS[r.payment_method] ?? "",
        Parcela: r.installment_label ?? "",
        Projetado: r.is_projected ? "Sim" : "Não",
      })),
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Planilha financeira"
        description={`${monthLongLabel(month)} · edição direta nas células`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="size-4" /> CSV
            </Button>
            {canWrite && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setDialogType("income")}>
                  <Plus className="size-4" /> Receita
                </Button>
                <Button size="sm" onClick={() => setDialogType("expense")}>
                  <Plus className="size-4" /> Despesa
                </Button>
              </>
            )}
          </>
        }
      />

      <TransactionDialog
        open={dialogType !== null}
        onOpenChange={(open) => !open && setDialogType(null)}
        type={dialogType ?? "expense"}
        defaultMonth={month}
      />

      <MonthTimeline rows={projection} selected={month} onSelect={setMonth} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Receitas do mês" value={money(monthRow.income)} />
        <StatCard label="Despesas do mês" value={money(monthRow.expense)} />
        <StatCard
          label="Saldo projetado"
          value={money(monthRow.balance)}
          tone={monthRow.balance < 0 ? "negative" : "positive"}
          hint={monthRow.balance < 0 ? `Déficit de ${money(monthRow.deficit)}` : "Mês positivo"}
        />
        <StatCard
          label="Saldo acumulado"
          value={money(monthRow.cumulative)}
          fill={accumulatedFill(monthRow.cumulative)}
          hint={
            monthRow.cumulative < -500
              ? "Crítico: abaixo de −R$ 500"
              : monthRow.cumulative <= 100
                ? "Atenção: entre −R$ 500 e R$ 100"
                : "Saudável: acima de R$ 100"
          }
        />
      </div>


      {monthRow.balance < 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-negative/40 bg-negative-soft px-4 py-3 text-sm text-negative">
          <AlertTriangle className="size-4" />
          Mês no vermelho: o déficit de {money(monthRow.deficit)} reduz o saldo inicial do mês
          seguinte.
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lançamentos de {monthLongLabel(month)}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Data</TableHead>
                  <TableHead className="min-w-[180px]">Descrição</TableHead>
                  <TableHead className="w-[130px]">Valor</TableHead>
                  <TableHead className="w-[110px]">Tipo</TableHead>
                  <TableHead className="w-[170px]">Categoria</TableHead>
                  <TableHead className="w-[140px]">Responsável</TableHead>
                  <TableHead className="w-[140px]">Pagamento</TableHead>
                  <TableHead className="w-[140px]">Recorrência</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Carregando lançamentos...
                    </TableCell>
                  </TableRow>
                )}
                {!rowsLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Nenhum lançamento neste mês.
                    </TableCell>
                  </TableRow>
                )}
                {!rowsLoading &&
                  rows.map((row) => (
                    <TransactionRow
                      key={`${row.transaction_id}-${month}`}
                      row={row}
                      canWrite={canWrite}
                      categories={categories}
                      members={members}
                      onUpdate={update.mutate}
                      onDelete={remove.mutate}
                    />
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Linhas marcadas como “recorrente” são projeções automáticas do lançamento original — edite o
        lançamento no mês de origem para alterá-las.
      </p>
    </div>
  );
}

function TransactionRow({
  row,
  canWrite,
  categories,
  members,
  onUpdate,
  onDelete,
}: {
  row: MonthTransaction;
  canWrite: boolean;
  categories: { id: string; name: string; kind: string }[];
  members: {
    user_id: string;
    profile: { full_name?: string | null; email?: string | null } | null;
  }[];
  onUpdate: (payload: { id: string; patch: Record<string, unknown> }) => void;
  onDelete: (id: string) => void;
}) {
  const readOnly = !canWrite || row.is_projected;
  const originId = row.origin_transaction_id;
  const amount = Number(row.amount);

  return (
    <TableRow>
      <TableCell>
        {row.is_projected ? (
          <span className="text-xs text-muted-foreground">recorrente</span>
        ) : (
          <Input
            type="date"
            defaultValue={row.display_date}
            disabled={readOnly}
            className="h-8 border-transparent px-1 text-xs shadow-none hover:border-input focus-visible:border-input"
            onBlur={(e) =>
              e.target.value !== row.display_date &&
              onUpdate({ id: originId, patch: { tx_date: e.target.value } })
            }
          />
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            defaultValue={row.description}
            disabled={readOnly}
            className="h-8 border-transparent px-1 shadow-none hover:border-input focus-visible:border-input"
            onBlur={(e) =>
              e.target.value !== row.description &&
              onUpdate({ id: originId, patch: { description: e.target.value } })
            }
          />
          {row.installment_label && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {row.installment_label}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          defaultValue={amount}
          disabled={readOnly}
          className="num h-8 border-transparent px-1 text-right shadow-none hover:border-input focus-visible:border-input"
          onBlur={(e) =>
            Number(e.target.value) !== amount &&
            onUpdate({ id: originId, patch: { amount: Number(e.target.value) } })
          }
        />
      </TableCell>
      <TableCell>
        <Select
          value={row.type}
          disabled={readOnly}
          onValueChange={(v) => onUpdate({ id: originId, patch: { type: v } })}
        >
          <SelectTrigger className="h-8 border-transparent px-1 text-xs shadow-none hover:border-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="income">Receita</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={row.category_id ?? "none"}
          disabled={readOnly}
          onValueChange={(v) =>
            onUpdate({
              id: originId,
              patch: { category_id: v === "none" ? null : v },
            })
          }
        >
          <SelectTrigger className="h-8 border-transparent px-1 text-xs shadow-none hover:border-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem categoria</SelectItem>
            {categories
              .filter((c) => (row.type === "income" ? c.kind === "income" : c.kind !== "income"))
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={row.owner_id ?? "none"}
          disabled={readOnly}
          onValueChange={(v) =>
            onUpdate({ id: originId, patch: { owner_id: v === "none" ? null : v } })
          }
        >
          <SelectTrigger className="h-8 border-transparent px-1 text-xs shadow-none hover:border-input">
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
      </TableCell>
      <TableCell>
        <Select
          value={row.payment_method}
          disabled={readOnly}
          onValueChange={(v) => onUpdate({ id: originId, patch: { payment_method: v } })}
        >
          <SelectTrigger className="h-8 border-transparent px-1 text-xs shadow-none hover:border-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENTS.map((p) => (
              <SelectItem key={p} value={p}>
                {PAYMENT_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={row.recurrence}
          disabled={readOnly}
          onValueChange={(v) =>
            onUpdate({
              id: originId,
              patch: {
                recurrence: v,
                installment_no: v === "installment" ? 1 : null,
                installment_total: v === "installment" ? 12 : null,
              },
            })
          }
        >
          <SelectTrigger className="h-8 border-transparent px-1 text-xs shadow-none hover:border-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECURRENCES.map((r) => (
              <SelectItem key={r} value={r}>
                {RECURRENCE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={row.status}
          disabled={readOnly}
          onValueChange={(v) => onUpdate({ id: originId, patch: { status: v } })}
        >
          <SelectTrigger className="h-8 border-transparent px-1 text-xs shadow-none hover:border-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="planned">Previsto</SelectItem>
            <SelectItem value="realized">Realizado</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {!row.is_projected && canWrite && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-negative"
            onClick={() => onDelete(originId)}
            aria-label="Excluir lançamento"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { useCards, useCategories, useFamily, useFamilyMembers } from "@/hooks/useFamily";
import { formatDate, money, monthKey, monthLongLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cartoes")({
  head: () => ({
    meta: [
      { title: "Cartões da família — Casa Clara" },
      {
        name: "description",
        content:
          "Cartões de crédito da família no Casa Clara: limite usado, faturas projetadas e baixa de pagamento.",
      },
      { property: "og:title", content: "Cartões da família — Casa Clara" },
      {
        property: "og:description",
        content: "Limite usado, faturas projetadas e pagamento de faturas do cartão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type CardRow = {
  id: string;
  name: string;
  brand: string | null;
  credit_limit: number;
  closing_day: number;
  due_day: number;
  owner_id: string | null;
};

type Projection = {
  cycle_month: string;
  due_date: string;
  total_amount: number;
  charge_count: number;
};

type Charge = { charge_date: string; description: string; amount: number };

type InvoiceRow = {
  id: string;
  cycle_month: string;
  due_date: string;
  total_amount: number;
  status: string;
  linked_transaction_id: string | null;
};

const emptyCard = {
  id: "",
  name: "",
  credit_limit: "",
  closing_day: "5",
  due_day: "15",
  owner_id: "none",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  closed: "Fechada",
  paid: "Paga",
  aberta: "Aberta",
  fechada: "Fechada",
  paga: "Paga",
};

function usedTone(percent: number) {
  if (percent > 80) return { bar: "bg-negative", text: "text-negative" };
  if (percent > 50) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-positive", text: "text-positive" };
}

function Page() {
  const { familyId, canWrite, isAdmin } = useFamily();
  const qc = useQueryClient();
  const { data: cards = [], isLoading } = useCards(familyId);
  const { data: members = [] } = useFamilyMembers(familyId);

  const [form, setForm] = useState(emptyCard);
  const [openForm, setOpenForm] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const memberName = (id: string | null) =>
    members.find((m) => m.user_id === id)?.profile?.full_name ?? "Família";

  const limits = useQuery({
    queryKey: ["card-limits", familyId, cards.map((c) => c.id).join(",")],
    enabled: cards.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        cards.map(async (c) => {
          const { data, error } = await supabase.rpc("card_available_limit", { p_card_id: c.id });
          if (error) throw error;
          return [c.id, Number(data ?? 0)] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        family_id: familyId!,
        name: form.name.trim(),
        credit_limit: Number(form.credit_limit) || 0,
        closing_day: Number(form.closing_day) || 1,
        due_day: Number(form.due_day) || 1,
        owner_id: form.owner_id === "none" ? null : form.owner_id,
      };
      if (form.id) {
        const { error } = await supabase
          .from("credit_cards")
          .update(payload as never)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("credit_cards").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cartão salvo");
      setOpenForm(false);
      setForm(emptyCard);
      qc.invalidateQueries({ queryKey: ["credit-cards"] });
      qc.invalidateQueries({ queryKey: ["card-limits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cartão excluído");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["credit-cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedCard = (cards as CardRow[]).find((c) => c.id === selected) ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cartões"
        description="Limite usado e faturas projetadas de cada cartão da família."
        actions={
          canWrite && (
            <Button
              onClick={() => {
                setForm(emptyCard);
                setOpenForm(true);
              }}
            >
              <Plus className="mr-1 size-4" /> Novo cartão
            </Button>
          )
        }
      />

      {isLoading ? (
        <EmptyState title="Carregando cartões…" />
      ) : cards.length === 0 ? (
        <EmptyState
          title="Nenhum cartão cadastrado"
          description="Cadastre um cartão para acompanhar limite e faturas projetadas."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(cards as CardRow[]).map((card) => {
            const available = limits.data?.[card.id];
            const used = available == null ? 0 : Number(card.credit_limit) - available;
            const percent =
              Number(card.credit_limit) > 0 ? (used / Number(card.credit_limit)) * 100 : 0;
            const tone = usedTone(percent);
            return (
              <Card
                key={card.id}
                className={cn(
                  "cursor-pointer transition-shadow hover:shadow-md",
                  selected === card.id && "ring-2 ring-ring",
                )}
                onClick={() => setSelected(selected === card.id ? null : card.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid size-9 place-items-center rounded-md bg-muted">
                        <CreditCard className="size-4" />
                      </span>
                      <div>
                        <p className="font-medium leading-tight">{card.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {memberName(card.owner_id)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {canWrite && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Editar cartão"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm({
                              id: card.id,
                              name: card.name,
                              credit_limit: String(card.credit_limit),
                              closing_day: String(card.closing_day),
                              due_day: String(card.due_day),
                              owner_id: card.owner_id ?? "none",
                            });
                            setOpenForm(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Excluir cartão"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Excluir o cartão "${card.name}"?`)) remove.mutate(card.id);
                          }}
                        >
                          <Trash2 className="size-4 text-negative" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Usado</span>
                      <span className={cn("num font-semibold", tone.text)}>
                        {money(used)} ({percent.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", tone.bar)}
                        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="num">Disponível {money(available ?? 0)}</span>
                      <span className="num">Limite {money(card.credit_limit)}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Fecha dia {card.closing_day}</span>
                    <span className="text-right">Vence dia {card.due_day}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedCard && <CardDetail card={selectedCard} />}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar cartão" : "Novo cartão"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="card-name">Nome</Label>
              <Input
                id="card-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Nubank Roxinho"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="card-limit">Limite total</Label>
              <Input
                id="card-limit"
                inputMode="decimal"
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="card-closing">Dia de fechamento</Label>
                <Input
                  id="card-closing"
                  type="number"
                  min={1}
                  max={28}
                  value={form.closing_day}
                  onChange={(e) => setForm({ ...form, closing_day: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="card-due">Dia de vencimento</Label>
                <Input
                  id="card-due"
                  type="number"
                  min={1}
                  max={28}
                  value={form.due_day}
                  onChange={(e) => setForm({ ...form, due_day: e.target.value })}
                />
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
                  <SelectItem value="none">Família</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profile?.full_name ?? m.profile?.email ?? "Membro"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cycleRange(cycleMonth: string, closingDay: number) {
  const iso = cycleMonth.slice(0, 10);
  const [y, m] = iso.split("-").map(Number);
  const end = new Date(y!, m! - 1, closingDay);
  const start = new Date(y!, m! - 2, closingDay);
  start.setDate(start.getDate() + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function CardDetail({ card }: { card: CardRow }) {
  const { familyId, canWrite } = useFamily();
  const qc = useQueryClient();
  const { data: members = [] } = useFamilyMembers(familyId);
  const { data: categories = [] } = useCategories(familyId);
  const [payFor, setPayFor] = useState<InvoiceRow | null>(null);

  const projection = useQuery({
    queryKey: ["card-projection", card.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("card_invoice_projection", {
        p_card_id: card.id,
        p_cycles: 6,
      });
      if (error) throw error;
      return (data ?? []) as unknown as Projection[];
    },
  });

  const invoices = useQuery({
    queryKey: ["card-invoices", card.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_invoices")
        .select("id, cycle_month, due_date, total_amount, status, linked_transaction_id")
        .eq("card_id", card.id);
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceRow[];
    },
  });

  const charges = useQuery({
    queryKey: ["card-charges", card.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("card_charges_expanded", {
        p_card_id: card.id,
        p_cycles: 2,
      });
      if (error) throw error;
      return (data ?? []) as unknown as Charge[];
    },
  });

  const currentKey = monthKey(new Date());
  const rows = projection.data ?? [];
  const invoiceFor = (cycle: string) =>
    (invoices.data ?? []).find((i) => i.cycle_month.slice(0, 7) === cycle.slice(0, 7)) ?? null;

  const defaultOpen = useMemo(() => {
    const match = rows.find((r) => r.cycle_month.slice(0, 7) === currentKey);
    return match ? match.cycle_month : rows[0]?.cycle_month;
  }, [rows, currentKey]);

  const pay = useMutation({
    mutationFn: async ({
      invoiceId,
      categoryId,
      ownerId,
    }: {
      invoiceId: string;
      categoryId: string | null;
      ownerId: string | null;
    }) => {
      const args: Record<string, string> = { p_invoice_id: invoiceId };
      if (categoryId) args["p_category_id"] = categoryId;
      if (ownerId) args["p_owner_id"] = ownerId;
      const { error } = await supabase.rpc("pay_card_invoice", args as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fatura marcada como paga");
      setPayFor(null);
      qc.invalidateQueries({ queryKey: ["card-invoices", card.id] });
      qc.invalidateQueries({ queryKey: ["card-limits"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Faturas — {card.name}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">próximos 6 ciclos</span>
            {canWrite && (
              <Button size="sm" onClick={() => setNewPurchase(true)}>
                <Plus className="size-4" /> Nova compra
              </Button>
            )}
          </div>
        </div>

        <TransactionDialog
          open={newPurchase}
          onOpenChange={setNewPurchase}
          type="expense"
          defaultCardId={card.id}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["card-projection", card.id] });
            qc.invalidateQueries({ queryKey: ["card-charges", card.id] });
            qc.invalidateQueries({ queryKey: ["card-limits"] });
          }}
        />


        {rows.length === 0 ? (
          <EmptyState
            title="Sem faturas projetadas"
            description="Lance despesas com forma de pagamento crédito neste cartão para ver as faturas."
          />
        ) : (
          <Accordion type="single" collapsible defaultValue={defaultOpen ?? ""}>
            {rows.map((row) => {
              const invoice = invoiceFor(row.cycle_month);
              const paid = invoice?.status === "paid" || invoice?.status === "paga";
              const isCurrent = row.cycle_month.slice(0, 7) === currentKey;
              const range = cycleRange(row.cycle_month, card.closing_day);
              const cycleCharges = (charges.data ?? []).filter(
                (c) => c.charge_date >= range.start && c.charge_date <= range.end,
              );
              return (
                <AccordionItem key={row.cycle_month} value={row.cycle_month}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full flex-wrap items-center justify-between gap-2 pr-2 text-left">
                      <div>
                        <p className="text-sm font-medium">
                          {monthLongLabel(row.cycle_month.slice(0, 7))}
                          {isCurrent && (
                            <Badge variant="secondary" className="ml-2 align-middle">
                              Ciclo atual
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vence {formatDate(row.due_date)} · {row.charge_count} lançamento
                          {row.charge_count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {invoice ? (
                          <Badge variant={paid ? "secondary" : "outline"}>
                            {STATUS_LABEL[invoice.status] ?? invoice.status}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Projetada</span>
                        )}
                        <span className="num text-sm font-semibold">
                          {money(invoice?.total_amount ?? row.total_amount)}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {isCurrent && cycleCharges.length > 0 && (
                      <ul className="mb-3 divide-y rounded-md border">
                        {cycleCharges.map((c, i) => (
                          <li
                            key={`${c.charge_date}-${c.description}-${i}`}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                          >
                            <span className="truncate">{c.description}</span>
                            <span className="flex items-center gap-3 whitespace-nowrap text-muted-foreground">
                              <span className="text-xs">{formatDate(c.charge_date)}</span>
                              <span className="num font-medium text-foreground">
                                {money(c.amount)}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {canWrite && invoice && !paid && (
                        <Button size="sm" onClick={() => setPayFor(invoice)}>
                          Marcar fatura como paga
                        </Button>
                      )}
                      {paid && invoice?.linked_transaction_id && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={`/planilha?tx=${invoice.linked_transaction_id}`}>
                            Ver lançamento na Planilha
                            <ExternalLink className="ml-1 size-3.5" />
                          </a>
                        </Button>
                      )}
                      {!invoice && (
                        <p className="text-xs text-muted-foreground">
                          Fatura futura ainda não sincronizada pelo sistema.
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>

      <PayDialog
        invoice={payFor}
        onClose={() => setPayFor(null)}
        categories={categories as { id: string; name: string; kind: string }[]}
        members={members}
        onConfirm={(categoryId, ownerId) =>
          payFor && pay.mutate({ invoiceId: payFor.id, categoryId, ownerId })
        }
        pending={pay.isPending}
      />
    </Card>
  );
}

function PayDialog({
  invoice,
  onClose,
  categories,
  members,
  onConfirm,
  pending,
}: {
  invoice: InvoiceRow | null;
  onClose: () => void;
  categories: { id: string; name: string; kind: string }[];
  members: { user_id: string; profile: { full_name: string; email: string | null } | null }[];
  onConfirm: (categoryId: string | null, ownerId: string | null) => void;
  pending: boolean;
}) {
  const suggested = categories.find((c) => /cart[ãa]o/i.test(c.name));
  const [categoryId, setCategoryId] = useState<string>(suggested?.id ?? "none");
  const [ownerId, setOwnerId] = useState<string>("none");

  return (
    <Dialog
      open={!!invoice}
      onOpenChange={(o) => {
        if (!o) onClose();
        else setCategoryId(suggested?.id ?? "none");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar fatura</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Vencimento {formatDate(invoice?.due_date)} ·{" "}
            <span className="num font-medium text-foreground">
              {money(invoice?.total_amount ?? 0)}
            </span>
          </p>
          <div className="grid gap-1.5">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
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
          <div className="grid gap-1.5">
            <Label>Responsável</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Família</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.profile?.full_name ?? m.profile?.email ?? "Membro"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              onConfirm(categoryId === "none" ? null : categoryId, ownerId === "none" ? null : ownerId)
            }
          >
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

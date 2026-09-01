import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCards, useCategories, useFamily, useFamilyMembers } from "@/hooks/useFamily";
import { PAYMENT_LABELS, RECURRENCE_LABELS } from "@/lib/finance";
import { todayISO } from "@/lib/format";

const PAYMENTS = Object.keys(PAYMENT_LABELS);
const RECURRENCES = Object.keys(RECURRENCE_LABELS);

export type TransactionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "income" | "expense";
  /** Pre-select a credit card (used by the "Nova compra" flow on the cards screen). */
  defaultCardId?: string | null;
  /** Default month in YYYY-MM to place the transaction date in. */
  defaultMonth?: string;
  onCreated?: () => void;
};

function defaultDate(month?: string) {
  if (!month) return todayISO();
  const today = new Date();
  const day = String(Math.min(today.getDate(), 28)).padStart(2, "0");
  return `${month}-${day}`;
}

export function TransactionDialog({
  open,
  onOpenChange,
  type,
  defaultCardId,
  defaultMonth,
  onCreated,
}: TransactionDialogProps) {
  const { user } = useAuth();
  const { familyId } = useFamily();
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories(familyId);
  const { data: members = [] } = useFamilyMembers(familyId);
  const { data: cards = [] } = useCards(familyId);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [txDate, setTxDate] = useState(defaultDate(defaultMonth));
  const [categoryId, setCategoryId] = useState("none");
  const [ownerId, setOwnerId] = useState("none");
  const [payment, setPayment] = useState(defaultCardId ? "credit" : "pix");
  const [recurrence, setRecurrence] = useState("none");
  const [cardId, setCardId] = useState(defaultCardId ?? "none");
  const [installments, setInstallments] = useState("12");
  const [status, setStatus] = useState("planned");

  useEffect(() => {
    if (!open) return;
    setDescription("");
    setAmount("");
    setTxDate(defaultDate(defaultMonth));
    setCategoryId("none");
    setOwnerId(user?.id ?? "none");
    setPayment(defaultCardId ? "credit" : "pix");
    setRecurrence("none");
    setCardId(defaultCardId ?? "none");
    setInstallments("12");
    setStatus("planned");
  }, [open, defaultCardId, defaultMonth, user?.id]);

  const isCredit = payment === "credit";
  const isInstallment = recurrence === "installment";
  const showCardFields = isCredit;

  const create = useMutation({
    mutationFn: async () => {
      const total = Number(installments) || 1;
      const payload: Record<string, unknown> = {
        family_id: familyId!,
        description: description.trim(),
        amount: Number(amount.replace(",", ".")) || 0,
        type,
        status,
        tx_date: txDate,
        category_id: categoryId === "none" ? null : categoryId,
        owner_id: ownerId === "none" ? null : ownerId,
        payment_method: payment,
        recurrence,
        card_id: isCredit && cardId !== "none" ? cardId : null,
        installment_no: isInstallment ? 1 : null,
        installment_total: isInstallment ? total : null,
        created_by: user!.id,
      };
      const { error } = await supabase.from("transactions").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(type === "income" ? "Receita lançada" : "Despesa lançada");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["month-transactions"] });
      qc.invalidateQueries({ queryKey: ["monthly-projection"] });
      qc.invalidateQueries({ queryKey: ["card-limits"] });
      qc.invalidateQueries({ queryKey: ["card-projection"] });
      qc.invalidateQueries({ queryKey: ["card-charges"] });
      onOpenChange(false);
      onCreated?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = description.trim().length > 0 && Number(amount.replace(",", ".")) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{type === "income" ? "Nova receita" : "Nova despesa"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="tx-desc">Descrição</Label>
            <Input
              id="tx-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === "income" ? "Ex.: Salário" : "Ex.: Supermercado"}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tx-amount">Valor</Label>
              <Input
                id="tx-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tx-date">Data</Label>
              <Input
                id="tx-date"
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {(categories as { id: string; name: string; kind: string }[])
                    .filter((c) => (type === "income" ? c.kind === "income" : c.kind !== "income"))
                    .map((c) => (
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
                      {m.profile?.full_name || m.profile?.email || "Membro"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger>
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
            </div>
            <div className="grid gap-1.5">
              <Label>Recorrência</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger>
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
            </div>
          </div>

          {(showCardFields || isInstallment) && (
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
              {showCardFields && (
                <div className="grid gap-1.5">
                  <Label>Cartão utilizado</Label>
                  <Select value={cardId} onValueChange={setCardId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cartão" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem cartão</SelectItem>
                      {(cards as { id: string; name: string }[]).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isInstallment && (
                <div className="grid gap-1.5">
                  <Label htmlFor="tx-installments">Número de parcelas</Label>
                  <Input
                    id="tx-installments"
                    type="number"
                    min={2}
                    max={60}
                    value={installments}
                    onChange={(e) => setInstallments(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}


          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Previsto</SelectItem>
                <SelectItem value="realized">Realizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            Salvar lançamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

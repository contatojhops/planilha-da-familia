import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { todayISO } from "@/lib/format";

export function FamilySetup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [familyName, setFamilyName] = useState("");
  const [income, setIncome] = useState("");
  const [incomeDesc, setIncomeDesc] = useState("Salário");
  const [expense, setExpense] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("Moradia");
  const [goalName, setGoalName] = useState("Reserva de emergência");
  const [goalTarget, setGoalTarget] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: familyId, error } = await supabase.rpc("create_family_with_owner", {
        p_family_name: familyName.trim() || "Minha família",
        p_display_name: user?.user_metadata?.["full_name"] ?? null,
      });
      if (error) throw error;
      const fam = { id: familyId as string };

      const { data: cats } = await supabase
        .from("categories")
        .select("id, name, kind")
        .eq("family_id", fam.id);

      const findCat = (name: string) => cats?.find((c) => c.name === name)?.id ?? null;
      const rows = [];
      if (Number(income) > 0) {
        rows.push({
          family_id: fam.id,
          description: incomeDesc || "Renda mensal",
          amount: Number(income),
          type: "income" as const,
          status: "planned" as const,
          tx_date: todayISO(),
          recurrence: "monthly" as const,
          category_id: findCat("Salário"),
          owner_id: user!.id,
          created_by: user!.id,
        });
      }
      if (Number(expense) > 0) {
        rows.push({
          family_id: fam.id,
          description: expenseDesc || "Despesa fixa",
          amount: Number(expense),
          type: "expense" as const,
          status: "planned" as const,
          tx_date: todayISO(),
          recurrence: "monthly" as const,
          category_id: findCat("Moradia"),
          owner_id: user!.id,
          created_by: user!.id,
        });
      }
      if (rows.length) {
        const { error: txErr } = await supabase.from("transactions").insert(rows);
        if (txErr) throw txErr;
      }
      if (Number(goalTarget) > 0) {
        const { error: goalErr } = await supabase.from("goals").insert({
          family_id: fam.id,
          name: goalName || "Reserva de emergência",
          target_amount: Number(goalTarget),
          created_by: user!.id,
        });
        if (goalErr) throw goalErr;
      }
      await supabase.from("families").update({ onboarding_done: true }).eq("id", fam.id);
      return fam;
    },
    onSuccess: () => {
      toast.success("Família criada! Bem-vindo ao Casa Clara.");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const steps = [
    {
      title: "Crie o núcleo familiar",
      description: "Todos os membros compartilham os mesmos dados, com permissões diferentes.",
      body: (
        <div className="space-y-2">
          <Label htmlFor="fam">Nome da família</Label>
          <Input
            id="fam"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="Família Oliveira"
          />
        </div>
      ),
    },
    {
      title: "Renda fixa mensal",
      description: "Vamos criar um lançamento recorrente de receita.",
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="idesc">Descrição</Label>
            <Input id="idesc" value={incomeDesc} onChange={(e) => setIncomeDesc(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ival">Valor mensal (R$)</Label>
            <Input
              id="ival"
              type="number"
              inputMode="decimal"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder="8500"
            />
          </div>
        </div>
      ),
    },
    {
      title: "Principal despesa fixa",
      description: "Aluguel, financiamento ou condomínio — o que mais pesa no mês.",
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edesc">Descrição</Label>
            <Input id="edesc" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eval">Valor mensal (R$)</Label>
            <Input
              id="eval"
              type="number"
              inputMode="decimal"
              value={expense}
              onChange={(e) => setExpense(e.target.value)}
              placeholder="2200"
            />
          </div>
        </div>
      ),
    },
    {
      title: "Primeira meta",
      description: "Uma meta clara ajuda a família a manter o plano.",
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gname">Meta</Label>
            <Input id="gname" value={goalName} onChange={(e) => setGoalName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gval">Valor-alvo (R$)</Label>
            <Input
              id="gval"
              type="number"
              inputMode="decimal"
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
              placeholder="30000"
            />
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step]!;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Passo {step + 1} de {steps.length}
          </p>
          <CardTitle>{current.title}</CardTitle>
          <CardDescription>{current.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {current.body}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              Voltar
            </Button>
            {step < steps.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && !familyName.trim()}
              >
                Continuar
              </Button>
            ) : (
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? "Criando..." : "Concluir"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
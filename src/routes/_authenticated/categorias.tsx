import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/finance-ui";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, useFamily } from "@/hooks/useFamily";
import { KIND_LABELS } from "@/lib/finance";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_NAMES,
  ICON_NAMES,
  categoryIcon,
} from "@/lib/category-icons";

export const Route = createFileRoute("/_authenticated/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias e orçamentos — Casa Clara" },
      {
        name: "description",
        content:
          "Organize receitas e despesas da família em categorias e subcategorias, com orçamento mensal por categoria.",
      },
      { property: "og:title", content: "Categorias e orçamentos — Casa Clara" },
      {
        property: "og:description",
        content: "Categorias, subcategorias e orçamento mensal da família.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Categorias;
});

type Kind = "income" | "fixed_expense" | "variable_expense" | "debt";

type Category = {
  id: string;
  name: string;
  kind: Kind;
  parent_id: string | null;
  icon: string;
  color: string;
  monthly_budget: number | string | null;
};

const KIND_OPTIONS: Kind[] = ["income", "fixed_expense", "variable_expense", "debt"];

const emptyForm = {
  id: "" as string,
  name: "",
  kind: "variable_expense" as Kind,
  parent_id: "none",
  icon: "sparkles",
  color: CATEGORY_COLORS[0]!,
  monthly_budget: "",
};

function Categorias() {
  const { familyId, canWrite, isAdmin } = useFamily();
  const qc = useQueryClient();
  const { data = [], isLoading } = useCategories(familyId);
  const categories = data as unknown as Category[];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories", familyId] });

  const parents = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const childrenOf = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of categories) {
      if (!c.parent_id) continue;
      map.set(c.parent_id, [...(map.get(c.parent_id) ?? []), c]);
    }
    return map;
  }, [categories]);

  const sections = [
    { title: "Receitas", rows: parents.filter((c) => c.kind === "income") },
    { title: "Despesas", rows: parents.filter((c) => c.kind !== "income") },
  ];

  const save = useMutation({
    mutationFn: async () => {
      const parent = form.parent_id === "none" ? null : form.parent_id;
      const parentKind = parents.find((p) => p.id === parent)?.kind;
      const payload = {
        family_id: familyId!,
        name: form.name.trim(),
        kind: (parentKind ?? form.kind) as Kind,
        parent_id: parent,
        icon: form.icon,
        color: form.color,
        monthly_budget: form.monthly_budget === "" ? null : Number(form.monthly_budget),
      };
      if (!payload.name) throw new Error("Informe um nome para a categoria");
      const { error } = form.id
        ? await supabase.from("categories").update(payload as never).eq("id", form.id)
        : await supabase.from("categories").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setForm(emptyForm);
      toast.success("Categoria salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setToDelete(null);
      toast.success("Categoria excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(c: Category) {
    setForm({
      id: c.id,
      name: c.name,
      kind: c.kind,
      parent_id: c.parent_id ?? "none",
      icon: c.icon,
      color: c.color,
      monthly_budget: c.monthly_budget === null ? "" : String(Number(c.monthly_budget)),
    });
    setOpen(true);
  }

  function Row({ c, child = false }: { c: Category; child?: boolean }) {
    const Icon = categoryIcon(c.icon);
    const kids = childrenOf.get(c.id) ?? [];
    const isOpen = !!expanded[c.id];
    const isDefault = DEFAULT_CATEGORY_NAMES.has(c.name);
    return (
      <div>
        <div
          className={cn(
            "flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0",
            child && "pl-10",
          )}
        >
          {kids.length > 0 ? (
            <button
              type="button"
              aria-label={isOpen ? "Recolher subcategorias" : "Expandir subcategorias"}
              onClick={() => setExpanded((s) => ({ ...s, [c.id]: !isOpen }))}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `${c.color}1f`, color: c.color }}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">{c.name}</p>
              {isDefault && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                  Padrão
                </Badge>
              )}
              {!child && (
                <span className="text-[11px] text-muted-foreground">{KIND_LABELS[c.kind]}</span>
              )}
              {kids.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {kids.length} subcategoria{kids.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="num mt-0.5 text-xs text-muted-foreground">
              {c.monthly_budget === null
                ? "Sem orçamento definido"
                : `Orçamento ${money(c.monthly_budget)}/mês`}
            </p>
          </div>
          {canWrite && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${c.name}`}
              onClick={() => openEdit(c)}
            >
              <Pencil className="size-4" />
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Excluir ${c.name}`}
              onClick={() => setToDelete(c)}
            >
              <Trash2 className="size-4 text-negative" />
            </Button>
          )}
        </div>
        {isOpen && kids.map((k) => <Row key={k.id} c={k} child />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Categorias"
        description="Estrutura de receitas e despesas usada em lançamentos, contas e orçamentos."
        actions={
          canWrite ? (
            <Button onClick={openNew}>
              <Plus className="mr-1 size-4" /> Nova categoria
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando categorias...</p>
      ) : categories.length === 0 ? (
        <EmptyState
          title="Nenhuma categoria"
          description="Crie a primeira categoria da família para organizar os lançamentos."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.title}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b px-3 py-2.5">
                  <h2 className="text-sm font-semibold">{section.title}</h2>
                  <span className="text-xs text-muted-foreground">{section.rows.length}</span>
                </div>
                {section.rows.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Nenhuma categoria nesta seção.
                  </p>
                ) : (
                  section.rows.map((c) => <Row key={c.id} c={c} />)
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Mercado"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm({ ...form, kind: v as Kind })}
                  disabled={form.parent_id !== "none"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Categoria-pai (opcional)</Label>
                <Select
                  value={form.parent_id}
                  onValueChange={(v) => setForm({ ...form, parent_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (categoria principal)</SelectItem>
                    {parents
                      .filter((p) => p.id !== form.id)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Ícone</Label>
              <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-md border p-2">
                {ICON_NAMES.map((name) => {
                  const Icon = categoryIcon(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-label={name}
                      onClick={() => setForm({ ...form, icon: name })}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted",
                        form.icon === name && "border-primary bg-muted text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Cor ${color}`}
                    onClick={() => setForm({ ...form, color })}
                    className={cn(
                      "size-7 rounded-full border-2",
                      form.color === color ? "border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cat-budget">Orçamento mensal (opcional)</Label>
              <Input
                id="cat-budget"
                inputMode="decimal"
                value={form.monthly_budget}
                onChange={(e) => setForm({ ...form, monthly_budget: e.target.value })}
                placeholder="Sem orçamento definido"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Lançamentos que usam esta categoria ficarão sem categoria. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && remove.mutate(toDelete.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

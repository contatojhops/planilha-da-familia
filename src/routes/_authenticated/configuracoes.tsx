import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Download,
  History,
  KeyRound,
  LogOut,
  Save,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EmptyState, PageHeader } from "@/components/finance-ui";
import { useAuth } from "@/hooks/useAuth";
import {
  AUDIT_PAGE_SIZE,
  useAuditLog,
  useDeleteFamily,
  useFamily,
  useFamilyMembers,
  useLeaveFamily,
  useProfile,
  useUpdateFamily,
  useUpdateProfile,
} from "@/hooks/useFamily";
import { money, relativeTime, todayISO } from "@/lib/format";
import { THEME_LABELS, setTheme, useTheme, type ThemeMode } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Ajustes — Casa Clara" },
      {
        name: "description",
        content:
          "Ajuste sua conta, os dados da família, os limiares do semáforo de saldo e veja o histórico de alterações no Casa Clara.",
      },
      { property: "og:title", content: "Ajustes — Casa Clara" },
      {
        property: "og:description",
        content: "Conta, família, notificações e histórico de alterações no Casa Clara.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const ENTITY_LABELS: Record<string, string> = {
  transactions: "Lançamento",
  bills: "Conta",
  goals: "Meta",
  goal_contributions: "Aporte em meta",
  credit_cards: "Cartão",
  card_invoices: "Fatura",
  investments: "Investimento",
  categories: "Categoria",
  family_members: "Membro",
  families: "Família",
  invitations: "Convite",
};

const ACTION_LABELS: Record<string, string> = {
  INSERT: "criou",
  UPDATE: "editou",
  DELETE: "excluiu",
};

const ALERT_DAYS = [0, 1, 3, 7];

const NOTIFY_FIELDS = [
  { key: "notify_bill_due", label: "Contas próximas do vencimento" },
  { key: "notify_negative_month", label: "Mês projetado no vermelho" },
  { key: "notify_over_budget", label: "Categoria acima do orçamento" },
  { key: "notify_goal_reached", label: "Meta atingida" },
] as const;

const EXPORT_TABLES = [
  "transactions",
  "categories",
  "bills",
  "goals",
  "investments",
  "credit_cards",
] as const;

function Page() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { familyId, family, role, isAdmin } = useFamily();
  const { data: profile, isLoading } = useProfile();
  const { data: members = [] } = useFamilyMembers(familyId);
  const updateProfile = useUpdateProfile();
  const updateFamily = useUpdateFamily();
  const leaveFamily = useLeaveFamily();
  const deleteFamily = useDeleteFamily();
  const { mode } = useTheme();

  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [emergencyTarget, setEmergencyTarget] = useState("");
  const [deficit, setDeficit] = useState("");
  const [warning, setWarning] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [confirmGlobalSignOut, setConfirmGlobalSignOut] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteTyped, setDeleteTyped] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setWhatsapp(profile.whatsapp ?? "");
    if (profile.theme && profile.theme !== mode) setTheme(profile.theme as ThemeMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    if (!family) return;
    setFamilyName(family.name);
    setEmergencyTarget(String(family.emergency_fund_target ?? 0));
    setDeficit(String(family.deficit_alert_threshold ?? -500));
    setWarning(String(family.warning_threshold ?? 100));
  }, [family?.id, family]);

  const adminCount = useMemo(() => members.filter((m) => m.role === "admin").length, [members]);
  const isOnlyAdmin = isAdmin && adminCount <= 1;
  const alertDays = (profile?.alert_days_before ?? []) as number[];

  const { data: audit = [], isFetching: auditFetching } = useAuditLog(
    isAdmin ? familyId : null,
    entityFilter,
    page,
  );

  async function saveAccount() {
    await updateProfile.mutateAsync({ full_name: fullName.trim(), whatsapp: whatsapp.trim() || null });
    toast.success("Dados salvos");
  }

  async function changePassword() {
    if (password.length < 8) return toast.error("A senha precisa ter ao menos 8 caracteres");
    if (password !== passwordConfirm) return toast.error("As senhas não coincidem");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return toast.error(error.message);
    setPassword("");
    setPasswordConfirm("");
    toast.success("Senha atualizada");
  }

  async function toggleNotify(key: string, value: boolean) {
    await updateProfile.mutateAsync({ [key]: value });
  }

  async function toggleAlertDay(day: number, checked: boolean) {
    const next = checked
      ? [...new Set([...alertDays, day])].sort((a, b) => a - b)
      : alertDays.filter((d) => d !== day);
    await updateProfile.mutateAsync({ alert_days_before: next });
  }

  async function changeTheme(next: ThemeMode) {
    setTheme(next);
    await updateProfile.mutateAsync({ theme: next });
  }

  async function saveFamily() {
    if (!familyId) return;
    if (!familyName.trim()) return toast.error("Informe o nome da família");
    await updateFamily.mutateAsync({
      familyId,
      patch: {
        name: familyName.trim(),
        emergency_fund_target: Number(emergencyTarget) || 0,
        deficit_alert_threshold: Number(deficit) || 0,
        warning_threshold: Number(warning) || 0,
      },
    });
    toast.success("Dados da família salvos");
  }

  async function globalSignOut() {
    setConfirmGlobalSignOut(false);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) return toast.error(error.message);
    navigate({ to: "/auth" });
  }

  async function doLeave() {
    if (!familyId) return;
    try {
      await leaveFamily.mutateAsync(familyId);
      setConfirmLeave(false);
      toast.success("Você saiu da família");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível sair da família");
    }
  }

  async function doDelete() {
    if (!familyId || !family) return;
    if (deleteTyped.trim() !== family.name) return toast.error("O nome digitado não confere");
    try {
      await deleteFamily.mutateAsync(familyId);
      setDeleteStep(0);
      toast.success("Família excluída");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir a família");
    }
  }

  async function exportJson() {
    if (!familyId) return;
    setExporting(true);
    try {
      const backup: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        family: family ?? null,
      };
      for (const table of EXPORT_TABLES) {
        const { data, error } = await supabase.from(table).select("*").eq("family_id", familyId);
        if (error) throw error;
        backup[table] = data ?? [];
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `family-backup-${todayISO()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Backup gerado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar os dados");
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Ajustes" />
        <EmptyState title="Carregando seus dados…" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ajustes"
        description="Sua conta, os dados da família e o histórico de alterações."
      />

      {/* 1. Minha conta */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-4" /> Minha conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Nome completo</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={whatsapp}
                placeholder="(11) 90000-0000"
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={user?.email ?? ""} readOnly disabled />
            </div>
          </div>
          <Button size="sm" onClick={saveAccount} disabled={updateProfile.isPending}>
            <Save className="size-4" /> Salvar dados
          </Button>

          <Separator />

          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4" /> Trocar senha
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                />
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={changePassword}>
              Atualizar senha
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">Preferências de notificação</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {NOTIFY_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  {field.label}
                  <Switch
                    checked={Boolean(profile?.[field.key])}
                    onCheckedChange={(value) => toggleNotify(field.key, value)}
                  />
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Avisar com quantos dias de antecedência</p>
              <div className="flex flex-wrap gap-4">
                {ALERT_DAYS.map((day) => (
                  <label key={day} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={alertDays.includes(day)}
                      onCheckedChange={(value) => toggleAlertDay(day, value === true)}
                    />
                    {day === 0 ? "No dia" : `${day} ${day === 1 ? "dia" : "dias"}`}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1.5">
              <Label>Tema</Label>
              <Select value={mode} onValueChange={(value) => changeTheme(value as ThemeMode)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(THEME_LABELS) as ThemeMode[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {THEME_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => setConfirmGlobalSignOut(true)}>
              <LogOut className="size-4" /> Sair de todos os dispositivos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Dados da família */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" /> Dados da família
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "Você é administrador e pode alterar estes dados."
              : "Somente administradores podem alterar estes dados."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="family-name">Nome da família</Label>
              <Input
                id="family-name"
                value={familyName}
                readOnly={!isAdmin}
                disabled={!isAdmin}
                onChange={(e) => setFamilyName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emergency">Meta de reserva de emergência (R$)</Label>
              <Input
                id="emergency"
                type="number"
                step="0.01"
                value={emergencyTarget}
                readOnly={!isAdmin}
                disabled={!isAdmin}
                onChange={(e) => setEmergencyTarget(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Usado para calcular quantos meses de despesas fixas sua reserva cobre
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deficit">Fica vermelho quando o acumulado ficar abaixo de</Label>
              <Input
                id="deficit"
                type="number"
                step="0.01"
                value={deficit}
                readOnly={!isAdmin}
                disabled={!isAdmin}
                onChange={(e) => setDeficit(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="warning">Fica amarelo até</Label>
              <Input
                id="warning"
                type="number"
                step="0.01"
                value={warning}
                readOnly={!isAdmin}
                disabled={!isAdmin}
                onChange={(e) => setWarning(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Acima de {money(Number(warning) || 0)} o saldo aparece em verde.
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={saveFamily} disabled={updateFamily.isPending}>
              <Save className="size-4" /> Salvar dados da família
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 3. Zona de perigo */}
      <Card className="border-negative/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-negative">
            <AlertTriangle className="size-4" /> Zona de perigo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3">
            <div>
              <p className="text-sm font-medium">Sair da família</p>
              <p className="text-xs text-muted-foreground">
                {isOnlyAdmin
                  ? "Transfira a administração para outra pessoa antes de sair"
                  : "Sua linha de membro é removida; seus lançamentos continuam na família."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isOnlyAdmin}
              onClick={() => setConfirmLeave(true)}
            >
              <LogOut className="size-4" /> Sair da família
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3">
            <div>
              <p className="text-sm font-medium">Exportar todos os dados (JSON)</p>
              <p className="text-xs text-muted-foreground">
                Baixa lançamentos, categorias, contas, metas, investimentos e cartões.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={exportJson} disabled={exporting}>
              <Download className="size-4" /> {exporting ? "Gerando…" : "Exportar"}
            </Button>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-negative/40 bg-negative-soft px-3 py-3">
              <div>
                <p className="text-sm font-medium text-negative">Excluir família</p>
                <p className="text-xs text-negative/80">
                  Apaga a família e todos os dados ligados a ela. Não há como desfazer.
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDeleteStep(1)}>
                <Trash2 className="size-4" /> Excluir família
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Histórico de alterações */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" /> Histórico de alterações
            </CardTitle>
            <Select
              value={entityFilter}
              onValueChange={(value) => {
                setEntityFilter(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-3">
            {audit.length === 0 ? (
              <EmptyState title="Nenhuma alteração registrada ainda" />
            ) : (
              <ul className="divide-y">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <Badge variant="secondary">
                      {ENTITY_LABELS[entry.entity] ?? entry.entity}
                    </Badge>
                    <span>
                      {entry.actor_name ?? "Alguém"}{" "}
                      <strong>{ACTION_LABELS[entry.action] ?? entry.action.toLowerCase()}</strong>
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {relativeTime(entry.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {audit.length >= (page + 1) * AUDIT_PAGE_SIZE && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={auditFetching}
              >
                {auditFetching ? "Carregando…" : "Carregar mais"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmGlobalSignOut} onOpenChange={setConfirmGlobalSignOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair de todos os dispositivos?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai encerrar sua sessão em todos os aparelhos, incluindo este. Você precisará
              entrar de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={globalSignOut}>Sair de tudo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da família {family?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Você perde o acesso aos dados compartilhados desta família. Para voltar, será
              necessário um novo convite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doLeave}>Sair da família</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteStep > 0}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteStep(0);
            setDeleteTyped("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a família {family?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível: apaga lançamentos, contas, categorias, metas,
              investimentos, cartões, faturas e o histórico de todos os membros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteStep === 2 && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-name">
                Digite <strong>{family?.name}</strong> para confirmar
              </Label>
              <Input
                id="confirm-name"
                value={deleteTyped}
                onChange={(e) => setDeleteTyped(e.target.value)}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {deleteStep === 1 ? (
              <Button variant="destructive" onClick={() => setDeleteStep(2)}>
                Entendi, continuar
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={doDelete}
                disabled={deleteTyped.trim() !== family?.name || deleteFamily.isPending}
              >
                Excluir definitivamente
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {role === "viewer" && (
        <p className="text-xs text-muted-foreground">
          Como visualizador, você pode ajustar apenas sua conta.
        </p>
      )}
    </div>
  );
}

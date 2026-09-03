import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Copy,
  Mail,
  Trash2,
  UserPlus,
  Users,
  Check,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/finance-ui";
import { useAuth } from "@/hooks/useAuth";
import {
  useFamily,
  useFamilyMembers,
  useInvitations,
  useCreateInvite,
  useRevokeInvite,
  useUpdateMemberRole,
  useRemoveMember,
  type FamilyRole,
} from "@/hooks/useFamily";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/familia")({
  head: () => ({
    meta: [
      { title: "Família — Casa Clara" },
      {
        name: "description",
        content: "Gerencie membros e convites da sua família no Casa Clara.",
      },
      { property: "og:title", content: "Família — Casa Clara" },
      { property: "og:description", content: "Gerencie membros e convites da sua família." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { familyId, isAdmin } = useFamily();
  const { data: members = [], isLoading: membersLoading } = useFamilyMembers(familyId);
  const { data: invitations = [], isLoading: invitesLoading } = useInvitations(familyId);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Família"
        description="Membros da família e convites pendentes"
        actions={
          isAdmin && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 size-4" /> Convidar membro
            </Button>
          )
        }
      />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="size-4" /> Membros atuais
        </h2>
        {membersLoading ? (
          <p className="text-sm text-muted-foreground">Carregando membros...</p>
        ) : members.length === 0 ? (
          <EmptyState title="Nenhum membro encontrado" description="Convide alguém para começar." />
        ) : (
          <div className="grid gap-3">
            {members.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </div>
        )}
      </section>

      {isAdmin && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Mail className="size-4" /> Convites pendentes
          </h2>
          {invitesLoading ? (
            <p className="text-sm text-muted-foreground">Carregando convites...</p>
          ) : invitations.length === 0 ? (
            <EmptyState title="Nenhum convite pendente" description="Convites enviados aparecerão aqui." />
          ) : (
            <div className="grid gap-3">
              {invitations.map((inv) => (
                <InviteRow key={inv.id} invite={inv} />
              ))}
            </div>
          )}
        </section>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

function MemberRow({ member }: { member: Awaited<ReturnType<typeof useFamilyMembers>["data"]>[number] }) {
  const { user } = useAuth();
  const { familyId, isAdmin } = useFamily();
  const updateRole = useUpdateMemberRole();
  const remove = useRemoveMember();
  const isSelf = member.user_id === user?.id;
  const adminCount =
    member.role === "admin"
      ? 1
      : 0; // placeholder; calculated below via hook

  const { data: members = [] } = useFamilyMembers(familyId);
  const admins = members.filter((m) => m.role === "admin");
  const isOnlyAdmin = isSelf && member.role === "admin" && admins.length === 1;
  const canManage = isAdmin && !isSelf;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="size-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">{member.profile?.full_name || member.profile?.email || "Sem nome"}</p>
          <p className="text-sm text-muted-foreground">{member.profile?.email || "—"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={member.role === "admin" ? "default" : "secondary"}>
              {ROLE_LABELS[member.role]}
            </Badge>
            <span>WhatsApp: {member.profile?.whatsapp || "Não cadastrado"}</span>
            <span>• Entrou em {formatDate(member.created_at)}</span>
          </div>
        </div>
      </div>
      {canManage && (
        <div className="flex items-center gap-2">
          <Select
            value={member.role}
            disabled={isOnlyAdmin || updateRole.isPending}
            onValueChange={(value) => {
              if (value === member.role) return;
              if (isOnlyAdmin) {
                toast.error("A família precisa de pelo menos um administrador.");
                return;
              }
              updateRole.mutate({ memberId: member.id, role: value as FamilyRole });
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="member">Membro</SelectItem>
              <SelectItem value="viewer">Visualizador</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={isOnlyAdmin || remove.isPending}
            onClick={() => {
              if (isOnlyAdmin) {
                toast.error("Você é o único administrador e não pode sair da família.");
                return;
              }
              if (!confirm("Tem certeza que deseja remover este membro da família?")) return;
              remove.mutate(member.id);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function InviteRow({ invite }: { invite: import("@/hooks/useFamily").Invitation }) {
  const revoke = useRevokeInvite();

  function copyLink() {
    const link = `${window.location.origin}/convite/${invite.token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado para a área de transferência.");
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{invite.email}</p>
        <p className="text-xs text-muted-foreground">
          Papel: {ROLE_LABELS[invite.role]} • Expira em {formatDate(invite.expires_at)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={copyLink}>
          <Copy className="mr-2 size-4" /> Copiar link
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={revoke.isPending}
          onClick={() => revoke.mutate(invite.id)}
        >
          Revogar
        </Button>
      </div>
    </div>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { familyId } = useFamily();
  const create = useCreateInvite();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<FamilyRole>("member");
  const [copied, setCopied] = useState(false);
  const link = create.data ? `${window.location.origin}/convite/${create.data}` : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !familyId) return;
    create.mutate({ familyId, email: email.trim(), role });
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copiado para a área de transferência.");
    setTimeout(() => setCopied(false), 2000);
  }

  function close() {
    setEmail("");
    setRole("member");
    create.reset();
    setCopied(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
          <DialogDescription>
            Envie um convite por e-mail. A pessoa precisa acessar o link para entrar na família.
          </DialogDescription>
        </DialogHeader>
        {!create.data ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-mail do convidado</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="convidado@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as FamilyRole)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending || !email.trim()}>
                {create.isPending ? "Enviando..." : "Gerar convite"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  Envie esse link para a pessoa convidada pelo WhatsApp ou e-mail. O convite expira
                  em 7 dias.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Link do convite</Label>
              <div className="flex gap-2">
                <Input readOnly value={link!} onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" onClick={copyLink}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={close}>Concluir</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

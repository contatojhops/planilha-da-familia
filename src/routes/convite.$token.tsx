import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { Mail, Users, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/finance";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/convite/$token")({
  head: () => ({
    meta: [
      { title: "Convite — Casa Clara" },
      { name: "description", content: "Aceite o convite para participar da gestão financeira familiar no Casa Clara." },
      { property: "og:title", content: "Convite — Casa Clara" },
      { property: "og:description", content: "Aceite o convite para participar da gestão financeira familiar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvitePage,
});

type Invite = {
  id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  token: string;
  expires_at: string;
  status: string;
  families: { id: string; name: string } | null;
};

function InvitePage() {
  const { token } = useParams({ from: "/convite/$token" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, token, expires_at, status, families(id, name)")
        .eq("token", token)
        .maybeSingle();
      if (error) {
        setError("Não foi possível carregar o convite.");
      } else if (!data || data.status !== "pending" || new Date(data.expires_at) < new Date()) {
        setError("Convite inválido ou expirado.");
      } else {
        setInvite(data as unknown as Invite);
      }
      setChecking(false);
    }
    load();
  }, [token]);

  useEffect(() => {
    if (!loading && !user && !checking) {
      navigate({ to: "/auth", search: { redirect: `/convite/${token}` } });
    }
  }, [user, loading, checking, navigate, token]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !invite) return;
    setAccepting(true);
    const { data: familyId, error } = await supabase.rpc("accept_family_invite", {
      p_token: token,
      p_display_name: displayName.trim() || null,
    });
    setAccepting(false);
    if (error) {
      toast.error(error.message || "Não foi possível aceitar o convite.");
      return;
    }
    toast.success("Você entrou na família!");
    navigate({ to: "/app" });
  }

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary px-4">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto size-10 text-destructive" />
            <CardTitle className="mt-4">Convite inválido</CardTitle>
            <CardDescription>{error || "Esse convite não existe ou já expirou."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate({ to: "/" })}>
              Voltar para o início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Users className="mx-auto size-10 text-primary" />
          <CardTitle className="mt-4">Você foi convidado!</CardTitle>
          <CardDescription>
            Para participar da família <strong>{invite.families?.name}</strong> como{" "}
            <Badge variant="secondary">{ROLE_LABELS[invite.role]}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-card p-3 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" /> Convite enviado para {invite.email}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Expira em {formatDate(invite.expires_at)}
            </p>
          </div>
          <form onSubmit={accept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Nome de exibição</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Como quer ser chamado na família?"
              />
            </div>
            <Button type="submit" className="w-full" disabled={accepting}>
              {accepting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 size-4" />
              )}
              {accepting ? "Aceitando..." : "Aceitar convite"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

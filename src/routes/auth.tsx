import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Casa Clara" },
      {
        name: "description",
        content:
          "Acesse a gestão financeira da sua família: planilha compartilhada, contas a vencer e projeção de saldo.",
      },
      { property: "og:title", content: "Entrar — Casa Clara" },
      {
        property: "og:description",
        content: "Entre para acompanhar o fluxo de caixa da sua família.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/app" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada! Verifique seu e-mail se a confirmação estiver ativa.");
    navigate({ to: "/app" });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold">Casa Clara</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão financeira compartilhada da família
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Acesse sua conta</CardTitle>
            <CardDescription>Cada membro entra com o próprio login.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form className="space-y-3 pt-4" onSubmit={signIn}>
                  <div className="space-y-2">
                    <Label htmlFor="e1">E-mail</Label>
                    <Input
                      id="e1"
                      type="email"
                      required
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p1">Senha</Label>
                    <Input
                      id="p1"
                      type="password"
                      required
                      value={password}
                      onChange={(ev) => setPassword(ev.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    Entrar
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form className="space-y-3 pt-4" onSubmit={signUp}>
                  <div className="space-y-2">
                    <Label htmlFor="n2">Nome</Label>
                    <Input
                      id="n2"
                      required
                      value={name}
                      onChange={(ev) => setName(ev.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e2">E-mail</Label>
                    <Input
                      id="e2"
                      type="email"
                      required
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p2">Senha</Label>
                    <Input
                      id="p2"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(ev) => setPassword(ev.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={google}>
              Continuar com Google
            </Button>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Dados isolados por família
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
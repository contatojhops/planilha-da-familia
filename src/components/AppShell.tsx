import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarClock,
  ChartPie,
  CreditCard,
  LayoutDashboard,
  LineChart,
  LogOut,
  Table2,
  Target,
  Users,
  Settings,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFamily } from "@/hooks/useFamily";
import { ROLE_LABELS } from "@/lib/finance";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/planilha", label: "Planilha", icon: Table2 },
  { to: "/contas", label: "Contas", icon: CalendarClock },
  { to: "/categorias", label: "Categorias", icon: ChartPie },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/investimentos", label: "Investimentos", icon: LineChart },
  { to: "/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/relatorios", label: "Relatórios", icon: ChartPie },
  { to: "/familia", label: "Família", icon: Users },
  { to: "/configuracoes", label: "Ajustes", icon: Settings },
] as const;

const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[7]];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 px-2">
      {NAV.map((item) => {
        const active = path === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { family, role } = useFamily();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar py-4 md:flex">
        <div className="px-5 pb-5">
          <p className="font-display text-lg font-semibold text-sidebar-foreground">Casa Clara</p>
          <p className="truncate text-xs text-sidebar-foreground/60">
            {family?.name ?? "Sua família"}
          </p>
        </div>
        <NavList />
        <div className="mt-auto px-4 pt-4">
          <p className="truncate text-xs text-sidebar-foreground/60">{user?.email}</p>
          <p className="text-xs text-sidebar-primary">{role ? ROLE_LABELS[role] : ""}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-card/85 px-3 backdrop-blur md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0 pt-10">
              <NavList onNavigate={() => setOpen(false)} />
              <div className="mt-4 px-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sidebar-foreground/75"
                  onClick={() => supabase.auth.signOut()}
                >
                  <LogOut className="size-4" /> Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <p className="font-display text-sm font-semibold md:hidden">Casa Clara</p>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 px-3 pb-24 pt-4 md:px-6 md:pb-10">{children}</main>

        <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t bg-card md:hidden">
          {MOBILE_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground [&.active]:text-primary"
              activeProps={{ className: "active font-semibold" }}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
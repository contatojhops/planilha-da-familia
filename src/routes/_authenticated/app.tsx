import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, MonthTimeline, PageHeader, StatCard } from "@/components/finance-ui";
import {
  useBills,
  useCategories,
  useFamily,
  useFamilyMembers,
  useGoals,
  useInvestments,
  useTransactions,
} from "@/hooks/useFamily";
import { buildProjection, expandOccurrences, monthWindow, type Tx } from "@/lib/finance";
import { formatDate, money, monthKey, monthLongLabel, shortMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Dashboard financeiro da família — Casa Clara" },
      {
        name: "description",
        content:
          "Saldo do mês, projeção de 12 meses com semáforo, gastos por categoria e patrimônio líquido da família.",
      },
      { property: "og:title", content: "Dashboard financeiro da família — Casa Clara" },
      { property: "og:description", content: "Visão consolidada do fluxo de caixa da família." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard;
});

function Dashboard() {
  return null;
}
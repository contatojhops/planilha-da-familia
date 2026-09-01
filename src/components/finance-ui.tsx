import { AlertTriangle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { money, monthLabel } from "@/lib/format";
import type { MonthProjection } from "@/lib/finance";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  fill,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "positive" | "negative";
  /** Colors the whole card (background, border and text) — used by the balance traffic light. */
  fill?: "positive" | "warning" | "negative";
}) {
  return (
    <Card
      className={cn(
        fill === "positive" && "border-positive/40 bg-positive-soft text-positive",
        fill === "warning" && "border-warning/40 bg-warning-soft text-warning",
        fill === "negative" && "border-negative/40 bg-negative-soft text-negative",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-xs font-medium uppercase tracking-wide",
              fill ? "opacity-80" : "text-muted-foreground",
            )}
          >
            {label}
          </p>
          {Icon && <Icon className={cn("size-4", !fill && "text-muted-foreground")} />}
        </div>
        <p
          className={cn(
            "num mt-2 text-xl font-semibold md:text-2xl",
            !fill && tone === "positive" && "text-positive",
            !fill && tone === "negative" && "text-negative",
          )}
        >
          {value}
        </p>
        {hint && (
          <p className={cn("mt-1 text-xs", fill ? "opacity-80" : "text-muted-foreground")}>{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Traffic light thresholds for the accumulated balance. */
export function accumulatedFill(accumulated: number): "positive" | "warning" | "negative" {
  if (accumulated < -500) return "negative";
  if (accumulated <= 100) return "warning";
  return "positive";
}


export function MonthTimeline({
  rows,
  selected,
  onSelect,
}: {
  rows: MonthProjection[];
  selected?: string;
  onSelect?: (key: string) => void;
}) {
  return (
    <div className="-mx-3 overflow-x-auto px-3 pb-1 md:mx-0 md:px-0">
      <div className="flex min-w-max gap-2">
        {rows.map((row) => {
          const negative = row.balance < 0;
          const cumulativeNegative = row.cumulative < 0;
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => onSelect?.(row.key)}
              className={cn(
                "min-w-[104px] rounded-lg border px-3 py-2 text-left transition-colors",
                negative
                  ? "border-negative/40 bg-negative-soft"
                  : "border-positive/40 bg-positive-soft",
                selected === row.key && "ring-2 ring-ring",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase">{monthLabel(row.key)}</span>
                {(negative || cumulativeNegative) && (
                  <AlertTriangle
                    className={cn("size-3.5", negative ? "text-negative" : "text-warning")}
                  />
                )}
              </div>
              <p
                className={cn(
                  "num mt-1 text-sm font-semibold",
                  negative ? "text-negative" : "text-positive",
                )}
              >
                {money(row.balance)}
              </p>
              <p className="num text-[11px] text-muted-foreground">acum. {money(row.cumulative)}</p>
              {negative && (
                <p className="num text-[11px] font-medium text-negative">
                  déficit {money(row.deficit)}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
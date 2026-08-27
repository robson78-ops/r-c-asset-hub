import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ASSET_STATUS: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-success/15 text-success border-success/30" },
  manutencao: { label: "Em Manutenção", cls: "bg-warning/15 text-warning border-warning/30" },
  baixado: { label: "Baixado", cls: "bg-muted text-muted-foreground border-border" },
};

const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  aberto: { label: "Aberto", cls: "bg-info/15 text-info border-info/30" },
  em_andamento: { label: "Em Andamento", cls: "bg-primary/15 text-primary border-primary/30" },
  aguardando: { label: "Aguardando", cls: "bg-warning/15 text-warning border-warning/30" },
  resolvido: { label: "Resolvido", cls: "bg-success/15 text-success border-success/30" },
  fechado: { label: "Fechado", cls: "bg-muted text-muted-foreground border-border" },
};

const PRIORITY: Record<string, { label: string; cls: string }> = {
  baixa: { label: "Baixa", cls: "bg-muted text-muted-foreground border-border" },
  media: { label: "Média", cls: "bg-info/15 text-info border-info/30" },
  alta: { label: "Alta", cls: "bg-warning/15 text-warning border-warning/30" },
  critica: { label: "Crítica", cls: "bg-destructive/15 text-destructive border-destructive/40" },
};

export function AssetStatusBadge({ status }: { status: string }) {
  const v = ASSET_STATUS[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={cn("font-medium", v.cls)}>{v.label}</Badge>;
}
export function TicketStatusBadge({ status }: { status: string }) {
  const v = TICKET_STATUS[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={cn("font-medium", v.cls)}>{v.label}</Badge>;
}
export function PriorityBadge({ priority }: { priority: string }) {
  const v = PRIORITY[priority] ?? { label: priority, cls: "" };
  return <Badge variant="outline" className={cn("font-medium", v.cls)}>{v.label}</Badge>;
}

const SLA: Record<string, { label: string; cls: string }> = {
  no_prazo: { label: "No prazo", cls: "bg-success/15 text-success border-success/30" },
  atencao: { label: "Atenção", cls: "bg-warning/15 text-warning border-warning/30" },
  estourado: { label: "SLA estourado", cls: "bg-destructive/15 text-destructive border-destructive/40" },
};

export function SlaBadge({ status }: { status: string }) {
  const v = SLA[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={cn("font-medium", v.cls)}>{v.label}</Badge>;
}


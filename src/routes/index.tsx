import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Server, Wrench, PackageX, Ticket, AlertTriangle, CheckCircle2, Users, Gauge, FileSignature,
} from "lucide-react";
import { TicketStatusBadge, PriorityBadge, SlaBadge } from "@/components/StatusBadges";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard de Ativos e SLA — SGASD" },
      { name: "description", content: "Indicadores em tempo real de inventário, chamados e cumprimento de SLA da R&C Consultoria." },
      { property: "og:title", content: "Dashboard de Ativos e SLA — SGASD" },
      { property: "og:description", content: "Ativos alocados por cliente, chamados abertos vs. fechados e performance de SLA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});

interface AtivoRow {
  id: string;
  status: "ativo" | "manutencao" | "baixado";
  cliente_id: string | null;
  contrato_id: string | null;
  clientes?: { nome: string } | null;
}
interface TicketRow {
  id: string;
  numero: number;
  titulo: string;
  prioridade: "baixa" | "media" | "alta" | "critica";
  status: "aberto" | "em_andamento" | "aguardando" | "resolvido" | "fechado";
  sla_status: "no_prazo" | "atencao" | "estourado";
  due_date: string | null;
  resolved_at: string | null;
  created_at: string;
  cliente_id: string | null;
  contrato_id: string | null;
  ativos?: { nome: string } | null;
  clientes?: { nome: string } | null;
  contratos?: { numero: string } | null;
}
interface ContratoRow { id: string; numero: string; cliente_id: string; clientes?: { nome: string } | null; }
interface ClienteRow { id: string; nome: string; }

/** Métrica analítica de distribuição de ativos por cliente. */
interface AtivosPorCliente {
  nome: string;
  total: number;
  ativos: number;
  manutencao: number;
  baixados: number;
  percentual: number;
}


const ABERTOS = ["aberto", "em_andamento", "aguardando"];

function Dashboard() {
  const [ativos, setAtivos] = useState<AtivoRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [filtro, setFiltro] = useState<string>("todos"); // "todos" | "cliente:<id>" | "contrato:<id>"

  useEffect(() => {
    async function load() {
      const [a, t, ct, cl] = await Promise.all([
        supabase.from("ativos").select("id, status, cliente_id, contrato_id, clientes(nome)"),
        supabase.from("tickets").select("id, numero, titulo, prioridade, status, sla_status, due_date, created_at, cliente_id, contrato_id, ativos(nome), clientes(nome), contratos(numero)").order("created_at", { ascending: false }),
        supabase.from("contratos").select("id, numero, cliente_id, clientes(nome)").order("numero"),
        supabase.from("clientes").select("id, nome").order("nome"),
      ]);
      setAtivos((a.data ?? []) as unknown as AtivoRow[]);
      setTickets((t.data ?? []) as unknown as TicketRow[]);
      setContratos((ct.data ?? []) as unknown as ContratoRow[]);
      setClientes(cl.data ?? []);
    }
    load();
  }, []);

  const [tipoFiltro, idFiltro] = filtro === "todos" ? ["todos", ""] : filtro.split(":");

  const ativosF = useMemo(() => ativos.filter((a) =>
    tipoFiltro === "todos" ? true : tipoFiltro === "cliente" ? a.cliente_id === idFiltro : a.contrato_id === idFiltro
  ), [ativos, tipoFiltro, idFiltro]);

  const ticketsF = useMemo(() => tickets.filter((t) =>
    tipoFiltro === "todos" ? true : tipoFiltro === "cliente" ? t.cliente_id === idFiltro : t.contrato_id === idFiltro
  ), [tickets, tipoFiltro, idFiltro]);

  const abertos = ticketsF.filter((t) => ABERTOS.includes(t.status));
  const fechados = ticketsF.filter((t) => !ABERTOS.includes(t.status));
  const estourados = ticketsF.filter((t) => t.sla_status === "estourado");
  const slaPct = ticketsF.length === 0 ? 100 : Math.round(((ticketsF.length - estourados.length) / ticketsF.length) * 100);

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const cards = [
    { label: "Ativos alocados", value: ativosF.filter((a) => a.status === "ativo").length, icon: Server, color: "text-success", bg: "bg-success/10" },
    { label: "Em manutenção", value: ativosF.filter((a) => a.status === "manutencao").length, icon: Wrench, color: "text-warning", bg: "bg-warning/10" },
    { label: "Baixados", value: ativosF.filter((a) => a.status === "baixado").length, icon: PackageX, color: "text-muted-foreground", bg: "bg-muted" },
    { label: "Chamados abertos", value: abertos.length, icon: Ticket, color: "text-info", bg: "bg-info/10" },
    { label: "Chamados fechados", value: fechados.length, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: "Críticos pendentes", value: abertos.filter((t) => t.prioridade === "critica").length, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Contratos vigentes", value: (tipoFiltro === "todos" ? contratos : contratos.filter((c) => tipoFiltro === "cliente" ? c.cliente_id === idFiltro : c.id === idFiltro)).length, icon: FileSignature, color: "text-primary", bg: "bg-primary/10" },
    { label: "Clientes", value: tipoFiltro === "todos" ? clientes.length : 1, icon: Users, color: "text-primary", bg: "bg-primary/10" },
  ];

  // Ativos por cliente (top 5)
  const porCliente = useMemo(() => {
    const map = new Map<string, number>();
    ativosF.forEach((a) => {
      const nome = a.clientes?.nome ?? "Sem cliente";
      map.set(nome, (map.get(nome) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [ativosF]);

  const maxCliente = porCliente[0]?.[1] ?? 1;
  const recent = ticketsF.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Indicadores gerenciais do parque tecnológico, contratos e SLA.</p>
        </div>
        <div className="w-full sm:w-[300px]">
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger><SelectValue placeholder="Filtrar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes e contratos</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={`cliente:${c.id}`} value={`cliente:${c.id}`}>Cliente · {c.nome}</SelectItem>
              ))}
              {contratos.map((c) => (
                <SelectItem key={`contrato:${c.id}`} value={`contrato:${c.id}`}>Contrato · {c.numero} ({c.clientes?.nome ?? "—"})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-border/60 hover:border-primary/40 transition-colors">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold tracking-tight">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4 text-primary" /> Cumprimento de SLA</CardTitle>
            <CardDescription>Chamados atendidos dentro do prazo contratual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-4xl font-bold tracking-tight">{slaPct}%</p>
            <Progress value={slaPct} />
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline" className="bg-success/15 text-success border-success/30">
                {ticketsF.filter((t) => t.sla_status === "no_prazo").length} no prazo
              </Badge>
              <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
                {ticketsF.filter((t) => t.sla_status === "atencao").length} em atenção
              </Badge>
              <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/40">
                {estourados.length} estourados
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Resolvidos no mês: {ticketsF.filter((t) => t.status === "resolvido" && new Date(t.created_at) >= inicioMes).length}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ativos alocados por cliente</CardTitle>
            <CardDescription>Distribuição do inventário no parque atendido.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {porCliente.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum ativo no filtro selecionado.</p>
            ) : porCliente.map(([nome, qtd]) => (
              <div key={nome} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{nome}</span>
                  <span className="font-medium tabular-nums">{qtd}</span>
                </div>
                <Progress value={(qtd / maxCliente) * 100} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Chamados recentes</CardTitle>
            <CardDescription>Últimos 6 tickets do filtro selecionado.</CardDescription>
          </div>
          <Link to="/tickets" className="text-sm text-primary hover:underline">Ver todos →</Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum chamado registrado ainda.</p>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((t) => (
                <Link
                  key={t.id}
                  to="/tickets"
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-accent/40 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-muted-foreground pt-0.5">#{t.numero}</span>
                    <div>
                      <p className="text-sm font-medium">{t.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.ativos?.nome ? `${t.ativos.nome} • ` : ""}
                        {t.clientes?.nome ?? "Sem cliente"}
                        {t.contratos?.numero ? ` • ${t.contratos.numero}` : ""} •{" "}
                        {format(new Date(t.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SlaBadge status={t.sla_status} />
                    <PriorityBadge priority={t.prioridade} />
                    <TicketStatusBadge status={t.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

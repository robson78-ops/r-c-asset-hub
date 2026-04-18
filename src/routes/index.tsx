import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Server, Wrench, PackageX, Ticket, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { TicketStatusBadge, PriorityBadge } from "@/components/StatusBadges";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — SGASD" }] }),
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});

interface Stats {
  ativos: number;
  manutencao: number;
  baixados: number;
  ticketsAbertos: number;
  ticketsCriticos: number;
  ticketsResolvidosMes: number;
  clientes: number;
}

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [a, m, b, ta, tc, tr, c, rec] = await Promise.all([
        supabase.from("ativos").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("ativos").select("id", { count: "exact", head: true }).eq("status", "manutencao"),
        supabase.from("ativos").select("id", { count: "exact", head: true }).eq("status", "baixado"),
        supabase.from("tickets").select("id", { count: "exact", head: true }).in("status", ["aberto", "em_andamento", "aguardando"]),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("prioridade", "critica").in("status", ["aberto", "em_andamento", "aguardando"]),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "resolvido").gte("resolved_at", inicioMes.toISOString()),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("tickets").select("id, numero, titulo, prioridade, status, created_at, ativos(nome), clientes(nome)").order("created_at", { ascending: false }).limit(6),
      ]);
      setStats({
        ativos: a.count ?? 0,
        manutencao: m.count ?? 0,
        baixados: b.count ?? 0,
        ticketsAbertos: ta.count ?? 0,
        ticketsCriticos: tc.count ?? 0,
        ticketsResolvidosMes: tr.count ?? 0,
        clientes: c.count ?? 0,
      });
      setRecent(rec.data ?? []);
    }
    load();
  }, []);

  const cards = [
    { label: "Ativos em estoque", value: stats?.ativos, icon: Server, color: "text-success", bg: "bg-success/10" },
    { label: "Em manutenção", value: stats?.manutencao, icon: Wrench, color: "text-warning", bg: "bg-warning/10" },
    { label: "Baixados", value: stats?.baixados, icon: PackageX, color: "text-muted-foreground", bg: "bg-muted" },
    { label: "Chamados abertos", value: stats?.ticketsAbertos, icon: Ticket, color: "text-info", bg: "bg-info/10" },
    { label: "Críticos pendentes", value: stats?.ticketsCriticos, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Resolvidos no mês", value: stats?.ticketsResolvidosMes, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: "Clientes", value: stats?.clientes, icon: Users, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do parque tecnológico e do service desk.</p>
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
                <p className="text-2xl font-bold tracking-tight">{c.value ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Chamados recentes</CardTitle>
            <CardDescription>Últimos 6 tickets abertos no sistema.</CardDescription>
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
                        {t.clientes?.nome ?? "Sem cliente"} •{" "}
                        {format(new Date(t.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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

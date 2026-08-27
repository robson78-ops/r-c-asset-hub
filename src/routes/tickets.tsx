import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Ticket as TicketIcon, History } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { TicketStatusBadge, PriorityBadge } from "@/components/StatusBadges";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/tickets")({
  head: () => ({ meta: [{ title: "Service Desk — SGASD" }] }),
  component: () => (<RequireAuth><TicketsPage /></RequireAuth>),
});

type Priority = "baixa" | "media" | "alta" | "critica";
type Status = "aberto" | "em_andamento" | "aguardando" | "resolvido" | "fechado";
type SlaStatus = "no_prazo" | "atencao" | "estourado";

interface Ticket {
  id: string; numero: number; titulo: string; descricao: string | null;
  prioridade: Priority; status: Status; created_at: string; resolved_at: string | null;
  ativo_id: string | null; cliente_id: string | null; contrato_id: string | null;
  due_date: string | null; sla_status: SlaStatus;
  ativos?: { nome: string } | null; clientes?: { nome: string } | null;
  contratos?: { numero: string } | null;
}
interface AtivoOpt { id: string; nome: string; cliente_id: string | null; contrato_id: string | null; }
interface ClienteOpt { id: string; nome: string; }
interface ContratoOpt {
  id: string; numero: string; cliente_id: string;
  sla_baixa_horas: number; sla_media_horas: number; sla_alta_horas: number; sla_critica_horas: number;
  clientes?: { nome: string } | null;
}

const SLA_PADRAO: Record<Priority, number> = { critica: 4, alta: 8, media: 24, baixa: 72 };

export function horasSla(prioridade: Priority, contrato?: ContratoOpt | null): number {
  if (!contrato) return SLA_PADRAO[prioridade];
  const map: Record<Priority, number> = {
    critica: contrato.sla_critica_horas,
    alta: contrato.sla_alta_horas,
    media: contrato.sla_media_horas,
    baixa: contrato.sla_baixa_horas,
  };
  return map[prioridade] ?? SLA_PADRAO[prioridade];
}

function TicketsPage() {
  const { user, displayName } = useAuth();
  const [items, setItems] = useState<Ticket[]>([]);
  const [ativos, setAtivos] = useState<AtivoOpt[]>([]);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [contratos, setContratos] = useState<ContratoOpt[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Ticket | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [form, setForm] = useState({
    titulo: "", descricao: "", prioridade: "media" as Priority, status: "aberto" as Status,
    ativo_id: "none", cliente_id: "none", contrato_id: "none",
  });

  async function load() {
    const [t, a, c, ct] = await Promise.all([
      supabase.from("tickets").select("*, ativos(nome), clientes(nome), contratos(numero)").order("created_at", { ascending: false }),
      supabase.from("ativos").select("id, nome, cliente_id, contrato_id").order("nome"),
      supabase.from("clientes").select("id, nome").order("nome"),
      supabase.from("contratos").select("id, numero, cliente_id, sla_baixa_horas, sla_media_horas, sla_alta_horas, sla_critica_horas, clientes(nome)").order("numero"),
    ]);
    if (t.error) toast.error(t.error.message);
    setItems((t.data ?? []) as unknown as Ticket[]);
    setAtivos((a.data ?? []) as unknown as AtivoOpt[]);
    setClientes(c.data ?? []);
    setContratos((ct.data ?? []) as unknown as ContratoOpt[]);
  }
  useEffect(() => { load(); }, []);


  function openNew() {
    setEditing(null);
    setForm({ titulo: "", descricao: "", prioridade: "media", status: "aberto", ativo_id: "none", cliente_id: "none", contrato_id: "none" });
    setOpen(true);
  }
  function openEdit(t: Ticket) {
    setEditing(t);
    setForm({
      titulo: t.titulo, descricao: t.descricao ?? "",
      prioridade: t.prioridade, status: t.status,
      ativo_id: t.ativo_id ?? "none", cliente_id: t.cliente_id ?? "none",
      contrato_id: t.contrato_id ?? "none",
    });
    setOpen(true);
  }

  // Ao escolher o ativo, herda contrato e cliente automaticamente
  function onSelectAtivo(ativoId: string) {
    const ativo = ativos.find((x) => x.id === ativoId);
    setForm((f) => ({
      ...f,
      ativo_id: ativoId,
      contrato_id: ativo?.contrato_id ?? (f.contrato_id === "none" ? "none" : f.contrato_id),
      cliente_id: ativo?.cliente_id ?? f.cliente_id,
    }));
  }

  const contratoSelecionado = contratos.find((c) => c.id === form.contrato_id) ?? null;
  const slaHoras = horasSla(form.prioridade, contratoSelecionado);
  const previsaoSla = new Date(Date.now() + slaHoras * 3600_000);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return toast.error("Informe o título do chamado.");

    // Auto-vincula cliente do ativo/contrato se houver
    let cliente_id = form.cliente_id === "none" ? null : form.cliente_id;
    if (!cliente_id && form.ativo_id !== "none") {
      const ativo = ativos.find((x) => x.id === form.ativo_id);
      if (ativo?.cliente_id) cliente_id = ativo.cliente_id;
    }
    if (!cliente_id && contratoSelecionado) cliente_id = contratoSelecionado.cliente_id;

    const payload: any = {
      titulo: form.titulo.trim(),
      descricao: form.descricao || null,
      prioridade: form.prioridade,
      status: form.status,
      ativo_id: form.ativo_id === "none" ? null : form.ativo_id,
      contrato_id: form.contrato_id === "none" ? null : form.contrato_id,
      cliente_id,
    };
    if (form.status === "resolvido" && (!editing || editing.status !== "resolvido")) {
      payload.resolved_at = new Date().toISOString();
    }


    if (editing) {
      const { error } = await supabase.from("tickets").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      // Histórico de mudança
      if (editing.status !== form.status) {
        await supabase.from("ticket_historico").insert({
          ticket_id: editing.id, autor_id: user?.id, autor_nome: displayName ?? user?.email,
          acao: "status_alterado", comentario: `Status: ${editing.status} → ${form.status}`,
        });
      }
      toast.success("Chamado atualizado.");
    } else {
      const { data, error } = await supabase.from("tickets").insert({ ...payload, created_by: user?.id }).select().single();
      if (error) return toast.error(error.message);
      if (data) {
        await supabase.from("ticket_historico").insert({
          ticket_id: data.id, autor_id: user?.id, autor_nome: displayName ?? user?.email,
          acao: "criado", comentario: `Chamado aberto com prioridade ${form.prioridade}.`,
        });
      }
      toast.success("Chamado aberto.");
    }
    setOpen(false); load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("tickets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Chamado removido."); load();
  }

  async function openHistory(t: Ticket) {
    setHistoryOpen(t);
    setNewComment("");
    const { data } = await supabase.from("ticket_historico").select("*").eq("ticket_id", t.id).order("created_at", { ascending: true });
    setHistory(data ?? []);
  }

  async function addComment() {
    if (!historyOpen || !newComment.trim()) return;
    const { error } = await supabase.from("ticket_historico").insert({
      ticket_id: historyOpen.id, autor_id: user?.id, autor_nome: displayName ?? user?.email,
      acao: "comentario", comentario: newComment.trim(),
    });
    if (error) return toast.error(error.message);
    setNewComment("");
    const { data } = await supabase.from("ticket_historico").select("*").eq("ticket_id", historyOpen.id).order("created_at", { ascending: true });
    setHistory(data ?? []);
    toast.success("Comentário adicionado.");
  }

  const filtered = items.filter((t) => {
    const matchSearch = [t.titulo, t.descricao, t.ativos?.nome, t.clientes?.nome, String(t.numero)]
      .filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Service Desk</h1>
          <p className="text-sm text-muted-foreground">Tickets vinculados aos ativos e clientes — com histórico completo.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Abrir chamado</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? `Chamado #${editing.numero}` : "Abrir novo chamado"}</DialogTitle>
              <DialogDescription>Vincule ao ativo afetado para rastreabilidade.</DialogDescription>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-1.5"><Label>Título *</Label><Input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Resumo do problema" /></div>
              <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={4} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as Priority })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="aguardando">Aguardando</SelectItem>
                      <SelectItem value="resolvido">Resolvido</SelectItem>
                      <SelectItem value="fechado">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Ativo relacionado</Label>
                <Select value={form.ativo_id} onValueChange={onSelectAtivo}>
                  <SelectTrigger><SelectValue placeholder="Sem ativo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem ativo —</SelectItem>
                    {ativos.map((a) => (<SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Contrato</Label>
                <Select value={form.contrato_id} onValueChange={(v) => setForm({ ...form, contrato_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sem contrato" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem contrato (SLA padrão) —</SelectItem>
                    {contratos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.numero} — {c.clientes?.nome ?? "—"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <p className="font-medium text-foreground">SLA calculado automaticamente</p>
                <p className="mt-1 text-muted-foreground">
                  Severidade <span className="font-semibold text-foreground">{form.prioridade}</span> ·{" "}
                  {slaHoras}h {contratoSelecionado ? `(contrato ${contratoSelecionado.numero})` : "(padrão R&C)"} · prazo previsto{" "}
                  <span className="font-semibold text-foreground">{format(previsaoSla, "dd/MM HH:mm", { locale: ptBR })}</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem cliente —</SelectItem>
                    {clientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit">{editing ? "Salvar" : "Abrir chamado"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por título, número, ativo, cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0 shadow-none" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="resolvido">Resolvido</SelectItem>
                <SelectItem value="fechado">Fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <TicketIcon className="h-8 w-8" />
              <p className="text-sm">Nenhum chamado encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px]">Nº</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aberto em</TableHead>
                    <TableHead className="w-[160px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">#{t.numero}</TableCell>
                      <TableCell className="font-medium max-w-[280px] truncate">{t.titulo}</TableCell>
                      <TableCell className="text-muted-foreground">{t.ativos?.nome ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{t.clientes?.nome ?? "—"}</TableCell>
                      <TableCell><PriorityBadge priority={t.prioridade} /></TableCell>
                      <TableCell><TicketStatusBadge status={t.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(t.created_at), "dd/MM HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openHistory(t)} title="Histórico"><History className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover chamado?</AlertDialogTitle>
                              <AlertDialogDescription>O histórico será removido junto.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(t.id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!historyOpen} onOpenChange={(v) => !v && setHistoryOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico — #{historyOpen?.numero}</DialogTitle>
            <DialogDescription>{historyOpen?.titulo}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem registros ainda.</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="rounded-md border border-border bg-card/50 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{h.autor_nome ?? "Sistema"}</span>
                    <span className="text-muted-foreground">{format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-primary">{h.acao}</p>
                  {h.comentario && <p className="mt-1.5 text-sm whitespace-pre-wrap">{h.comentario}</p>}
                </div>
              ))
            )}
          </div>
          <div className="space-y-2">
            <Label>Adicionar comentário / manutenção</Label>
            <Textarea rows={3} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Descreva a ação executada..." />
            <Button onClick={addComment} disabled={!newComment.trim()} className="w-full">Registrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

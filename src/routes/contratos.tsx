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
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

export const Route = createFileRoute("/contratos")({
  head: () => ({
    meta: [
      { title: "Contratos e SLA — SGASD" },
      { name: "description", content: "Gestão de contratos de suporte da R&C Consultoria com metas de SLA por severidade." },
      { property: "og:title", content: "Contratos e SLA — SGASD" },
      { property: "og:description", content: "Contratos vinculados a clientes, ativos e chamados com metas de SLA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (<RequireAuth><ContratosPage /></RequireAuth>),
});

export interface Contrato {
  id: string;
  cliente_id: string;
  numero: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  status: "ativo" | "encerrado";
  sla_baixa_horas: number;
  sla_media_horas: number;
  sla_alta_horas: number;
  sla_critica_horas: number;
  clientes?: { nome: string } | null;
}
interface ClienteOpt { id: string; nome: string; }

const emptyForm = {
  cliente_id: "", numero: "", descricao: "", data_inicio: new Date().toISOString().slice(0, 10),
  data_fim: "", status: "ativo" as Contrato["status"],
  sla_baixa_horas: 72, sla_media_horas: 24, sla_alta_horas: 8, sla_critica_horas: 4,
};

function ContratosPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  async function load() {
    const [ct, cl] = await Promise.all([
      supabase.from("contratos").select("*, clientes(nome)").order("created_at", { ascending: false }),
      supabase.from("clientes").select("id, nome").order("nome"),
    ]);
    if (ct.error) toast.error(ct.error.message);
    setItems((ct.data ?? []) as unknown as Contrato[]);
    setClientes(cl.data ?? []);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }
  function openEdit(c: Contrato) {
    setEditing(c);
    setForm({
      cliente_id: c.cliente_id, numero: c.numero, descricao: c.descricao ?? "",
      data_inicio: c.data_inicio, data_fim: c.data_fim ?? "", status: c.status,
      sla_baixa_horas: c.sla_baixa_horas, sla_media_horas: c.sla_media_horas,
      sla_alta_horas: c.sla_alta_horas, sla_critica_horas: c.sla_critica_horas,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) return toast.error("Selecione o cliente do contrato.");
    if (!form.numero.trim()) return toast.error("Informe o número do contrato.");
    const payload = {
      cliente_id: form.cliente_id,
      numero: form.numero.trim(),
      descricao: form.descricao || null,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      status: form.status,
      sla_baixa_horas: Number(form.sla_baixa_horas),
      sla_media_horas: Number(form.sla_media_horas),
      sla_alta_horas: Number(form.sla_alta_horas),
      sla_critica_horas: Number(form.sla_critica_horas),
    };
    if (editing) {
      const { error } = await supabase.from("contratos").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Contrato atualizado.");
    } else {
      const { error } = await supabase.from("contratos").insert({ ...payload, created_by: user?.id });
      if (error) return toast.error(error.message);
      toast.success("Contrato cadastrado.");
    }
    setOpen(false); load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Contrato removido."); load();
  }

  const filtered = items.filter((c) =>
    [c.numero, c.descricao, c.clientes?.nome].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contratos &amp; SLA</h1>
          <p className="text-sm text-muted-foreground">Cliente → Contrato → Ativos → Chamados, com metas de atendimento por severidade.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo contrato</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? `Contrato ${editing.numero}` : "Novo contrato"}</DialogTitle>
              <DialogDescription>Defina as horas de SLA por severidade do chamado.</DialogDescription>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Número *</Label><Input required value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="CT-2026-001" /></div>
                <div className="space-y-1.5">
                  <Label>Situação</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Contrato["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="encerrado">Encerrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Término</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1.5"><Label className="text-xs">Crítica (h)</Label><Input type="number" min={1} value={form.sla_critica_horas} onChange={(e) => setForm({ ...form, sla_critica_horas: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Alta (h)</Label><Input type="number" min={1} value={form.sla_alta_horas} onChange={(e) => setForm({ ...form, sla_alta_horas: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Média (h)</Label><Input type="number" min={1} value={form.sla_media_horas} onChange={(e) => setForm({ ...form, sla_media_horas: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Baixa (h)</Label><Input type="number" min={1} value={form.sla_baixa_horas} onChange={(e) => setForm({ ...form, sla_baixa_horas: Number(e.target.value) })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit">{editing ? "Salvar" : "Cadastrar"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por número, cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0 shadow-none" />
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <FileSignature className="h-8 w-8" />
              <p className="text-sm">Nenhum contrato cadastrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>SLA (C / A / M / B)</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-[120px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.numero}</TableCell>
                      <TableCell className="text-muted-foreground">{c.clientes?.nome ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(c.data_inicio), "dd/MM/yyyy")}
                        {c.data_fim ? ` → ${format(new Date(c.data_fim), "dd/MM/yyyy")}` : " → indeterminado"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.sla_critica_horas}h / {c.sla_alta_horas}h / {c.sla_media_horas}h / {c.sla_baixa_horas}h
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={c.status === "ativo" ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground border-border"}>
                          {c.status === "ativo" ? "Ativo" : "Encerrado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover contrato?</AlertDialogTitle>
                              <AlertDialogDescription>Ativos e chamados vinculados ficarão sem contrato.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(c.id)}>Remover</AlertDialogAction>
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
    </div>
  );
}

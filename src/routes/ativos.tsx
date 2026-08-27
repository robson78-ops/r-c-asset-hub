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
import { Plus, Pencil, Trash2, Search, Server } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { AssetStatusBadge } from "@/components/StatusBadges";
import { format } from "date-fns";

export const Route = createFileRoute("/ativos")({
  head: () => ({ meta: [{ title: "Ativos — SGASD" }] }),
  component: () => (<RequireAuth><AtivosPage /></RequireAuth>),
});

interface Ativo {
  id: string; nome: string; marca: string | null; modelo: string | null;
  numero_serial: string | null; data_garantia: string | null;
  status: "ativo" | "manutencao" | "baixado"; observacoes: string | null;
  cliente_id: string | null; contrato_id: string | null;
  clientes?: { nome: string } | null;
  contratos?: { numero: string; clientes?: { nome: string } | null } | null;
}
interface ClienteOpt { id: string; nome: string; }
interface ContratoOpt { id: string; numero: string; cliente_id: string; clientes?: { nome: string } | null; }

function AtivosPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Ativo[]>([]);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [contratos, setContratos] = useState<ContratoOpt[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ativo | null>(null);
  const [form, setForm] = useState({
    nome: "", marca: "", modelo: "", numero_serial: "", data_garantia: "",
    status: "ativo" as Ativo["status"], cliente_id: "none", contrato_id: "none", observacoes: "",
  });

  async function load() {
    const [a, c, ct] = await Promise.all([
      supabase.from("ativos").select("*, clientes(nome), contratos(numero, clientes(nome))").order("created_at", { ascending: false }),
      supabase.from("clientes").select("id, nome").order("nome"),
      supabase.from("contratos").select("id, numero, cliente_id, clientes(nome)").order("numero"),
    ]);
    if (a.error) toast.error(a.error.message);
    setItems((a.data ?? []) as unknown as Ativo[]);
    setClientes(c.data ?? []);
    setContratos((ct.data ?? []) as unknown as ContratoOpt[]);
  }
  useEffect(() => { load(); }, []);


  function openNew() {
    setEditing(null);
    setForm({ nome: "", marca: "", modelo: "", numero_serial: "", data_garantia: "", status: "ativo", cliente_id: "none", observacoes: "" });
    setOpen(true);
  }
  function openEdit(a: Ativo) {
    setEditing(a);
    setForm({
      nome: a.nome, marca: a.marca ?? "", modelo: a.modelo ?? "",
      numero_serial: a.numero_serial ?? "", data_garantia: a.data_garantia ?? "",
      status: a.status, cliente_id: a.cliente_id ?? "none", observacoes: a.observacoes ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Informe o nome do equipamento.");
    const payload = {
      nome: form.nome.trim(),
      marca: form.marca || null, modelo: form.modelo || null,
      numero_serial: form.numero_serial || null,
      data_garantia: form.data_garantia || null,
      status: form.status,
      cliente_id: form.cliente_id === "none" ? null : form.cliente_id,
      observacoes: form.observacoes || null,
    };
    if (editing) {
      const { error } = await supabase.from("ativos").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Ativo atualizado.");
    } else {
      const { error } = await supabase.from("ativos").insert({ ...payload, created_by: user?.id });
      if (error) return toast.error(error.message);
      toast.success("Ativo cadastrado.");
    }
    setOpen(false); load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("ativos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Ativo removido."); load();
  }

  const filtered = items.filter((a) =>
    [a.nome, a.marca, a.modelo, a.numero_serial, a.clientes?.nome].filter(Boolean).join(" ")
      .toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventário de Ativos</h1>
          <p className="text-sm text-muted-foreground">Equipamentos tecnológicos cadastrados no parque.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo ativo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar ativo" : "Novo ativo"}</DialogTitle>
              <DialogDescription>Cadastro de equipamento tecnológico.</DialogDescription>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-1.5"><Label>Nome do equipamento *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Notebook Dell Latitude" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Marca</Label><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Modelo</Label><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Nº de série</Label><Input value={form.numero_serial} onChange={(e) => setForm({ ...form, numero_serial: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Data garantia</Label><Input type="date" value={form.data_garantia} onChange={(e) => setForm({ ...form, data_garantia: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Ativo["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="manutencao">Em Manutenção</SelectItem>
                      <SelectItem value="baixado">Baixado</SelectItem>
                    </SelectContent>
                  </Select>
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
              </div>
              <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
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
            <Input placeholder="Buscar por nome, marca, serial, cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0 shadow-none" />
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Server className="h-8 w-8" />
              <p className="text-sm">Nenhum ativo encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Marca / Modelo</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Garantia</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{[a.marca, a.modelo].filter(Boolean).join(" / ") || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{a.numero_serial ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.data_garantia ? format(new Date(a.data_garantia), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.clientes?.nome ?? "—"}</TableCell>
                      <TableCell><AssetStatusBadge status={a.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover ativo?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(a.id)}>Remover</AlertDialogAction>
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

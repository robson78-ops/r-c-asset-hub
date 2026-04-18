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
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — SGASD" }] }),
  component: () => (<RequireAuth><ClientesPage /></RequireAuth>),
});

interface Cliente {
  id: string; nome: string; documento: string | null; email: string | null;
  telefone: string | null; endereco: string | null; observacoes: string | null;
}

function ClientesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ nome: "", documento: "", email: "", telefone: "", endereco: "", observacoes: "" });

  async function load() {
    const { data, error } = await supabase.from("clientes").select("*").order("nome");
    if (error) return toast.error(error.message);
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ nome: "", documento: "", email: "", telefone: "", endereco: "", observacoes: "" });
    setOpen(true);
  }
  function openEdit(c: Cliente) {
    setEditing(c);
    setForm({
      nome: c.nome, documento: c.documento ?? "", email: c.email ?? "",
      telefone: c.telefone ?? "", endereco: c.endereco ?? "", observacoes: c.observacoes ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Informe o nome do cliente.");
    const payload = {
      nome: form.nome.trim(),
      documento: form.documento || null,
      email: form.email || null,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      observacoes: form.observacoes || null,
    };
    if (editing) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Cliente atualizado.");
    } else {
      const { error } = await supabase.from("clientes").insert({ ...payload, created_by: user?.id });
      if (error) return toast.error(error.message);
      toast.success("Cliente cadastrado.");
    }
    setOpen(false);
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cliente removido.");
    load();
  }

  const filtered = items.filter((c) =>
    [c.nome, c.documento, c.email].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Cadastro central — base para vincular ativos e chamados.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
              <DialogDescription>Informações de contato e identificação.</DialogDescription>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1.5"><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Documento (CNPJ/CPF)</Label><Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
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
            <Input placeholder="Buscar por nome, documento ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 focus-visible:ring-0 shadow-none" />
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <UsersIcon className="h-8 w-8" />
              <p className="text-sm">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{c.documento ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.telefone ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Os ativos e chamados vinculados serão preservados, mas perderão a associação.
                            </AlertDialogDescription>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

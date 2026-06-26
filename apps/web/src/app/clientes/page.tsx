"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, getErrorMessage } from "@/lib/api";
import type { Cliente } from "@/types/api";

type ClienteForm = {
  nombre: string;
  documento: string;
  telefono: string;
  direccion: string;
};

const initialForm: ClienteForm = {
  nombre: "",
  documento: "",
  telefono: "",
  direccion: "",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [form, setForm] = useState<ClienteForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const columns = useMemo<ColumnDef<Cliente>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "nombre", header: "Nombre" },
      { accessorKey: "documento", header: "Documento" },
      { accessorKey: "telefono", header: "Telefono" },
      { accessorKey: "direccion", header: "Direccion" },
      {
        accessorKey: "activo",
        header: "Activo",
        cell: ({ row }) => (
          <Badge variant={row.original.activo ? "default" : "secondary"}>
            {row.original.activo ? "Si" : "No"}
          </Badge>
        ),
      },
    ],
    [],
  );

  async function loadClientes() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get<Cliente[]>("/clientes");
      setClientes(response.data);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadClientes);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.nombre.trim()) {
      setError("El nombre del cliente es obligatorio");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await api.post("/clientes", {
        nombre: form.nombre.trim(),
        documento: form.documento.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
      });
      setForm(initialForm);
      await loadClientes();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Registro y consulta de clientes para ventas a credito."
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nuevo cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                placeholder="Nombre"
                value={form.nombre}
                onChange={(event) =>
                  setForm({ ...form, nombre: event.target.value })
                }
              />
              <Input
                placeholder="Documento"
                value={form.documento}
                onChange={(event) =>
                  setForm({ ...form, documento: event.target.value })
                }
              />
              <Input
                placeholder="Telefono"
                value={form.telefono}
                onChange={(event) =>
                  setForm({ ...form, telefono: event.target.value })
                }
              />
              <Input
                placeholder="Direccion"
                value={form.direccion}
                onChange={(event) =>
                  setForm({ ...form, direccion: event.target.value })
                }
              />
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <Button type="submit" className="w-full" disabled={saving}>
                <Plus className="size-4" />
                {saving ? "Guardando..." : "Crear cliente"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listado de clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">
                Cargando clientes...
              </p>
            ) : (
              <DataTable
                columns={columns}
                data={clientes}
                emptyMessage="No hay clientes registrados"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

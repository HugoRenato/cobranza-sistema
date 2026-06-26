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
import { Textarea } from "@/components/ui/textarea";
import { api, getErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Producto } from "@/types/api";

type ProductoForm = {
  nombre: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioBase: string;
  stock: string;
};

const initialForm: ProductoForm = {
  nombre: "",
  codigo: "",
  descripcion: "",
  unidad: "",
  precioBase: "",
  stock: "",
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [form, setForm] = useState<ProductoForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const columns = useMemo<ColumnDef<Producto>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "nombre", header: "Nombre" },
      { accessorKey: "codigo", header: "Codigo" },
      { accessorKey: "unidad", header: "Unidad" },
      {
        accessorKey: "precioBase",
        header: "Precio base",
        cell: ({ row }) => formatCurrency(row.original.precioBase),
      },
      {
        accessorKey: "stock",
        header: "Stock",
        cell: ({ row }) => row.original.stock ?? "-",
      },
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

  async function loadProductos() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get<Producto[]>("/productos");
      setProductos(response.data);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadProductos);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.nombre.trim()) {
      setError("El nombre del producto es obligatorio");
      return;
    }

    const precioBase = Number(form.precioBase);

    if (!Number.isFinite(precioBase) || precioBase <= 0) {
      setError("El precio base debe ser mayor a 0");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await api.post("/productos", {
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim() || undefined,
        descripcion: form.descripcion.trim() || undefined,
        unidad: form.unidad.trim() || undefined,
        precioBase,
        stock: form.stock.trim() ? Number(form.stock) : undefined,
      });
      setForm(initialForm);
      await loadProductos();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Productos"
        description="Catalogo base para registrar ventas a credito."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nuevo producto</CardTitle>
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
                placeholder="Codigo"
                value={form.codigo}
                onChange={(event) =>
                  setForm({ ...form, codigo: event.target.value })
                }
              />
              <Textarea
                placeholder="Descripcion"
                value={form.descripcion}
                onChange={(event) =>
                  setForm({ ...form, descripcion: event.target.value })
                }
              />
              <Input
                placeholder="Unidad"
                value={form.unidad}
                onChange={(event) =>
                  setForm({ ...form, unidad: event.target.value })
                }
              />
              <Input
                placeholder="Precio base"
                type="number"
                min="0"
                step="0.01"
                value={form.precioBase}
                onChange={(event) =>
                  setForm({ ...form, precioBase: event.target.value })
                }
              />
              <Input
                placeholder="Stock"
                type="number"
                min="0"
                step="0.01"
                value={form.stock}
                onChange={(event) =>
                  setForm({ ...form, stock: event.target.value })
                }
              />
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <Button type="submit" className="w-full" disabled={saving}>
                <Plus className="size-4" />
                {saving ? "Guardando..." : "Crear producto"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listado de productos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">
                Cargando productos...
              </p>
            ) : (
              <DataTable
                columns={columns}
                data={productos}
                emptyMessage="No hay productos registrados"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

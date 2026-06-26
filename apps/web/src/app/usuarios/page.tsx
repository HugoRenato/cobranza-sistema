"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Power, PowerOff } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, getErrorMessage } from "@/lib/api";
import type { Usuario } from "@/types/api";

type UsuarioForm = {
  nombre: string;
  email: string;
  password: string;
};

const initialForm: UsuarioForm = {
  nombre: "",
  email: "",
  password: "",
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [form, setForm] = useState<UsuarioForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsuarios = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get<Usuario[]>("/usuarios");
      setUsuarios(response.data);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadUsuarios);
  }, [loadUsuarios]);

  const toggleEstado = useCallback(
    async (usuario: Usuario) => {
      try {
        setError("");
        setSuccess("");
        const path =
          usuario.estado === "ACTIVO"
            ? `/usuarios/${usuario.id}/desactivar`
            : `/usuarios/${usuario.id}/activar`;
        await api.patch(path);
        setSuccess(
          usuario.estado === "ACTIVO"
            ? "Usuario desactivado"
            : "Usuario activado",
        );
        await loadUsuarios();
      } catch (caughtError) {
        setError(getErrorMessage(caughtError));
      }
    },
    [loadUsuarios],
  );

  const columns = useMemo<ColumnDef<Usuario>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "nombre", header: "Nombre" },
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "estado",
        header: "Estado",
        cell: ({ row }) => (
          <Badge
            variant={row.original.estado === "ACTIVO" ? "default" : "secondary"}
          >
            {row.original.estado}
          </Badge>
        ),
      },
      {
        accessorKey: "ultimoLogin",
        header: "Último login",
        cell: ({ row }) =>
          row.original.ultimoLogin
            ? new Date(row.original.ultimoLogin).toLocaleString("es-PE")
            : "-",
      },
      {
        id: "acciones",
        header: "Acciones",
        cell: ({ row }) => {
          const activo = row.original.estado === "ACTIVO";

          return (
            <Button
              type="button"
              variant={activo ? "outline" : "default"}
              size="sm"
              onClick={() => void toggleEstado(row.original)}
            >
              {activo ? (
                <PowerOff className="size-4" />
              ) : (
                <Power className="size-4" />
              )}
              {activo ? "Desactivar" : "Activar"}
            </Button>
          );
        },
      },
    ],
    [toggleEstado],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.nombre.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Nombre, email y contraseña son obligatorios");
      return;
    }

    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await api.post("/usuarios", form);
      setForm(initialForm);
      setSuccess("Usuario creado correctamente");
      await loadUsuarios();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Administra el acceso de los usuarios del sistema."
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Crear usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                placeholder="Nombre"
                value={form.nombre}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nombre: event.target.value,
                  }))
                }
              />
              <Input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
              <Input
                placeholder="Contraseña"
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
              <Button type="submit" className="w-full" disabled={saving}>
                <Plus className="size-4" />
                {saving ? "Guardando..." : "Crear usuario"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base">Usuarios registrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </p>
            ) : null}
            {loading ? (
              <p className="text-sm text-muted-foreground">
                Cargando usuarios...
              </p>
            ) : (
              <DataTable
                columns={columns}
                data={usuarios}
                emptyMessage="No hay usuarios registrados"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

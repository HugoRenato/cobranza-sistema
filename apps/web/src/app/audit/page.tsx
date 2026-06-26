"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, getErrorMessage } from "@/lib/api";
import type { AuditAction, AuditLog } from "@/types/api";

const actions: AuditAction[] = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "ANULAR",
  "AJUSTE",
  "COMPENSACION",
  "DOWNLOAD",
];

type AuditFilters = {
  action: string;
  module: string;
  fechaDesde: string;
  fechaHasta: string;
};

const initialFilters: AuditFilters = {
  action: "",
  module: "",
  fechaDesde: "",
  fechaHasta: "",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState<AuditFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<AuditFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString("es-PE"),
      },
      {
        accessorKey: "usuarioEmail",
        header: "Usuario",
        cell: ({ row }) => row.original.usuarioEmail ?? "-",
      },
      {
        accessorKey: "action",
        header: "Acción",
        cell: ({ row }) => <Badge variant="secondary">{row.original.action}</Badge>,
      },
      { accessorKey: "module", header: "Módulo" },
      {
        accessorKey: "entity",
        header: "Entidad",
        cell: ({ row }) =>
          [row.original.entity, row.original.entityId].filter(Boolean).join(" #") ||
          "-",
      },
      { accessorKey: "description", header: "Descripción" },
      {
        accessorKey: "ip",
        header: "IP",
        cell: ({ row }) => row.original.ip ?? "-",
      },
    ],
    [],
  );

  const loadAudit = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = Object.fromEntries(
        Object.entries(appliedFilters).filter(([, value]) => Boolean(value)),
      );
      const response = await api.get<AuditLog[]>("/audit", { params });
      setLogs(response.data);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void Promise.resolve().then(loadAudit);
  }, [loadAudit]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(filters);
  }

  function clearFilters() {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
  }

  return (
    <div>
      <PageHeader
        title="Auditoría"
        description="Consulta eventos críticos del sistema y actividad de usuarios."
      />

      <Card className="mb-6 rounded-md">
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-[180px_1fr_180px_180px_auto_auto]"
            onSubmit={handleSubmit}
          >
            <Select
              value={filters.action || "TODAS"}
              onValueChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  action: value === "TODAS" ? "" : String(value),
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas</SelectItem>
                {actions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Módulo"
              value={filters.module}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  module: event.target.value,
                }))
              }
            />
            <Input
              type="date"
              value={filters.fechaDesde}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  fechaDesde: event.target.value,
                }))
              }
            />
            <Input
              type="date"
              value={filters.fechaHasta}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  fechaHasta: event.target.value,
                }))
              }
            />
            <Button type="submit">
              <Search className="size-4" />
              Buscar
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters}>
              <X className="size-4" />
              Limpiar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="text-base">Registros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Cargando auditoría...
            </p>
          ) : (
            <DataTable
              columns={columns}
              data={logs}
              emptyMessage="No hay registros de auditoría"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

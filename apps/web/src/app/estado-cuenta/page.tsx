"use client";

import { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  Banknote,
  CalendarSearch,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  ReceiptText,
  Search,
  X,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, getErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  Cliente,
  EstadoCuentaCliente,
  MovimientoCuenta,
} from "@/types/api";

const resumenCards = [
  { label: "Saldo actual", key: "saldoActual", icon: CircleDollarSign },
  {
    label: "Total vendido credito",
    key: "totalVendidoCredito",
    icon: ReceiptText,
  },
  { label: "Total abonado", key: "totalAbonado", icon: Banknote },
  { label: "Deuda pendiente", key: "deudaPendiente", icon: BadgeDollarSign },
  { label: "Deuda vencida", key: "deudaVencida", icon: Clock3 },
  {
    label: "Ventas pendientes",
    key: "cantidadVentasPendientes",
    icon: CalendarSearch,
  },
  { label: "Pagos", key: "cantidadPagos", icon: FileText },
] as const;

export default function EstadoCuentaPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuentaCliente | null>(
    null,
  );
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingEstado, setLoadingEstado] = useState(false);
  const [error, setError] = useState("");

  async function loadClientes() {
    try {
      setLoadingClientes(true);
      setError("");
      const response = await api.get<Cliente[]>("/clientes");
      setClientes(response.data);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoadingClientes(false);
    }
  }

  async function loadEstadoCuenta(
    nextClienteId = clienteId,
    filtros = { fechaDesde, fechaHasta },
  ) {
    if (!nextClienteId) {
      setEstadoCuenta(null);
      return;
    }

    try {
      setLoadingEstado(true);
      setError("");
      const params = new URLSearchParams();

      if (filtros.fechaDesde) {
        params.set("fechaDesde", filtros.fechaDesde);
      }

      if (filtros.fechaHasta) {
        params.set("fechaHasta", filtros.fechaHasta);
      }

      const query = params.toString();
      const response = await api.get<EstadoCuentaCliente>(
        `/estado-cuenta/cliente/${nextClienteId}${query ? `?${query}` : ""}`,
      );
      setEstadoCuenta(response.data);
    } catch {
      setEstadoCuenta(null);
      setError("No se pudo cargar el estado de cuenta.");
    } finally {
      setLoadingEstado(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadClientes);
  }, []);

  async function handleClienteChange(value: string | null) {
    const nextClienteId = value ?? "";
    setClienteId(nextClienteId);
    setFechaDesde("");
    setFechaHasta("");
    await loadEstadoCuenta(nextClienteId, { fechaDesde: "", fechaHasta: "" });
  }

  async function handleBuscar() {
    await loadEstadoCuenta();
  }

  async function handleLimpiarFiltros() {
    setFechaDesde("");
    setFechaHasta("");
    await loadEstadoCuenta(clienteId, { fechaDesde: "", fechaHasta: "" });
  }

  function handleDescargarPdf() {
    if (!clienteId) {
      setError("Selecciona un cliente para descargar el Kardex PDF.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
    const params = new URLSearchParams();

    if (fechaDesde) {
      params.set("fechaDesde", fechaDesde);
    }

    if (fechaHasta) {
      params.set("fechaHasta", fechaHasta);
    }

    const query = params.toString();
    const url = `${apiUrl}/reportes/clientes/${clienteId}/kardex-cobranza/pdf${
      query ? `?${query}` : ""
    }`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <PageHeader
        title="Estado de cuenta"
        description="Consulta la situacion financiera y el historial de movimientos de cada cliente."
      />

      <Card className="mb-6">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.5fr_1fr_1fr_auto_auto_auto]">
          <div className="space-y-2">
            <label className="text-sm font-medium">Cliente</label>
            <Select value={clienteId} onValueChange={handleClienteChange}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue
                  placeholder={
                    loadingClientes
                      ? "Cargando clientes..."
                      : "Seleccionar cliente"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((cliente) => (
                  <SelectItem key={cliente.id} value={`${cliente.id}`}>
                    {cliente.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha desde</label>
            <Input
              type="date"
              value={fechaDesde}
              onChange={(event) => setFechaDesde(event.target.value)}
              disabled={!clienteId}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha hasta</label>
            <Input
              type="date"
              value={fechaHasta}
              onChange={(event) => setFechaHasta(event.target.value)}
              disabled={!clienteId}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              onClick={() => void handleBuscar()}
              disabled={!clienteId || loadingEstado}
            >
              <Search className="size-4" />
              Buscar
            </Button>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleLimpiarFiltros()}
              disabled={!clienteId || loadingEstado}
            >
              <X className="size-4" />
              Limpiar
            </Button>
          </div>
          {clienteId ? (
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleDescargarPdf}
              >
                <Download className="size-4" />
                Descargar Kardex PDF
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!clienteId ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Selecciona un cliente para ver su estado de cuenta.
          </CardContent>
        </Card>
      ) : loadingEstado ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Cargando estado de cuenta...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : estadoCuenta ? (
        <div className="space-y-6">
          <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Datos del cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="Nombre" value={estadoCuenta.cliente.nombre} />
                <InfoRow
                  label="Documento"
                  value={estadoCuenta.cliente.documento || "-"}
                />
                <InfoRow
                  label="Telefono"
                  value={estadoCuenta.cliente.telefono || "-"}
                />
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {resumenCards.map((item) => {
                const Icon = item.icon;
                const value = estadoCuenta.resumen[item.key];
                const isCount = item.key.startsWith("cantidad");

                return (
                  <Card key={item.key}>
                    <CardContent className="flex min-h-24 items-center justify-between p-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-2 text-xl font-semibold">
                          {isCount ? value : formatCurrency(value)}
                        </p>
                      </div>
                      <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              {estadoCuenta.movimientos.length ? (
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descripcion</TableHead>
                        <TableHead className="text-right">Cargo</TableHead>
                        <TableHead className="text-right">Abono</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estadoCuenta.movimientos.map((movimiento) => (
                        <TableRow key={movimiento.id}>
                          <TableCell>{formatDate(movimiento.fecha)}</TableCell>
                          <TableCell>
                            <MovimientoBadge tipo={movimiento.tipo} />
                          </TableCell>
                          <TableCell>{movimiento.descripcion}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Math.abs(Number(movimiento.cargo)))}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Math.abs(Number(movimiento.abono)))}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(movimiento.saldo)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Este cliente a�n no tiene movimientos registrados.
                </p>
              )}
            </CardContent>
          </Card>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ventas pendientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Compromiso</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Observacion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estadoCuenta.ventasPendientes.length ? (
                        estadoCuenta.ventasPendientes.map((venta) => (
                          <TableRow key={venta.id}>
                            <TableCell>{venta.id}</TableCell>
                            <TableCell>
                              {formatDate(venta.fechaVenta)}
                            </TableCell>
                            <TableCell>
                              {formatDate(venta.fechaCompromisoPago)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(venta.total)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(venta.saldoPendiente)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{venta.estado}</Badge>
                            </TableCell>
                            <TableCell className="max-w-40 truncate text-muted-foreground">
                              {venta.observacion || "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <EmptyRow
                          colSpan={7}
                          message="No hay ventas pendientes"
                        />
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pagos realizados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Medio</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Referencia</TableHead>
                        <TableHead>Observacion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estadoCuenta.pagos.length ? (
                        estadoCuenta.pagos.map((pago) => (
                          <TableRow key={pago.id}>
                            <TableCell>{pago.id}</TableCell>
                            <TableCell>{formatDate(pago.fechaPago)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(pago.monto)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {pago.medioPago}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  pago.estado === "VALIDO"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {pago.estado}
                              </Badge>
                            </TableCell>
                            <TableCell>{pago.referencia || "-"}</TableCell>
                            <TableCell className="max-w-40 truncate text-muted-foreground">
                              {pago.observacion || "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <EmptyRow
                          colSpan={7}
                          message="No hay pagos registrados"
                        />
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      ) : null}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function MovimientoBadge({ tipo }: { tipo: MovimientoCuenta["tipo"] }) {
  if (tipo === "ANULACION") {
    return <Badge variant="destructive">{tipo}</Badge>;
  }

  if (tipo === "ABONO") {
    return <Badge variant="secondary">{tipo}</Badge>;
  }

  if (tipo === "VENTA") {
    return <Badge variant="default">{tipo}</Badge>;
  }

  return <Badge variant="outline">{tipo}</Badge>;
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="h-24 text-center text-muted-foreground"
      >
        {message}
      </TableCell>
    </TableRow>
  );
}

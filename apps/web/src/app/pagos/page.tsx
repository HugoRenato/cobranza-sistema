"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Ban, RefreshCw, Save } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { api, getErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  Cliente,
  CreatePagoPayload,
  EstadoCuentaCliente,
  MedioPago,
  PagoAbono,
} from "@/types/api";

const mediosPago: MedioPago[] = [
  "EFECTIVO",
  "YAPE",
  "PLIN",
  "TRANSFERENCIA",
  "TARJETA",
  "OTRO",
];

export default function PagosPage() {
  const [pagos, setPagos] = useState<PagoAbono[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuentaCliente | null>(
    null,
  );
  const [clienteId, setClienteId] = useState("");
  const [monto, setMonto] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago>("EFECTIVO");
  const [fechaPago, setFechaPago] = useState("");
  const [referencia, setReferencia] = useState("");
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingEstado, setLoadingEstado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [annullingId, setAnnullingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCliente = useMemo(
    () => clientes.find((cliente) => `${cliente.id}` === clienteId),
    [clientes, clienteId],
  );

  async function loadPagos() {
    const response = await api.get<PagoAbono[]>("/pagos");
    setPagos(response.data);
  }

  async function loadEstadoCuenta(nextClienteId = clienteId) {
    if (!nextClienteId) {
      setEstadoCuenta(null);
      return;
    }

    try {
      setLoadingEstado(true);
      const response = await api.get<EstadoCuentaCliente>(
        `/estado-cuenta/cliente/${nextClienteId}`,
      );
      setEstadoCuenta(response.data);
    } catch (caughtError) {
      setEstadoCuenta(null);
      setError(getErrorMessage(caughtError));
    } finally {
      setLoadingEstado(false);
    }
  }

  async function loadInitialData() {
    try {
      setLoading(true);
      setError("");
      const [pagosResponse, clientesResponse] = await Promise.all([
        api.get<PagoAbono[]>("/pagos"),
        api.get<Cliente[]>("/clientes"),
      ]);
      setPagos(pagosResponse.data);
      setClientes(clientesResponse.data);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadInitialData);
  }, []);

  async function handleClienteChange(value: string | null) {
    const nextClienteId = value ?? "";
    setClienteId(nextClienteId);
    setSuccess("");
    setError("");
    await loadEstadoCuenta(nextClienteId);
  }

  function validatePayload(): CreatePagoPayload | null {
    if (!clienteId) {
      setError("Seleccione un cliente");
      return null;
    }

    const saldoActual = estadoCuenta?.resumen.saldoActual ?? 0;
    const montoNumber = Number(monto);

    if (saldoActual <= 0) {
      setError("El cliente no tiene saldo pendiente para registrar un pago");
      return null;
    }

    if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
      setError("El monto debe ser mayor a 0");
      return null;
    }

    if (montoNumber > saldoActual) {
      setError("El monto no puede ser mayor al saldo actual del cliente");
      return null;
    }

    return {
      clienteId: Number(clienteId),
      monto: montoNumber,
      medioPago,
      ...(fechaPago ? { fechaPago } : {}),
      ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
      ...(observacion.trim() ? { observacion: observacion.trim() } : {}),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const payload = validatePayload();

    if (!payload) {
      return;
    }

    try {
      setSaving(true);
      await api.post("/pagos", payload);
      setMonto("");
      setMedioPago("EFECTIVO");
      setFechaPago("");
      setReferencia("");
      setObservacion("");
      setSuccess("Abono registrado correctamente");
      await Promise.all([loadPagos(), loadEstadoCuenta()]);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleAnularPago(pago: PagoAbono) {
    const confirmed = window.confirm(
      `¿Desea anular el pago #${pago.id} por ${formatCurrency(pago.monto)}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setAnnullingId(pago.id);
      setError("");
      setSuccess("");
      await api.patch(`/pagos/${pago.id}/anular`);
      setSuccess(`Pago #${pago.id} anulado correctamente`);
      await Promise.all([loadPagos(), loadEstadoCuenta()]);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setAnnullingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Pagos y abonos"
        description="Registra abonos parciales y controla anulaciones con trazabilidad."
      />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nuevo abono</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cliente</label>
                  <Select value={clienteId} onValueChange={handleClienteChange}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Seleccionar cliente" />
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Monto</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={monto}
                      onChange={(event) => setMonto(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Medio de pago</label>
                    <Select
                      value={medioPago}
                      onValueChange={(value) =>
                        setMedioPago((value ?? "EFECTIVO") as MedioPago)
                      }
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {mediosPago.map((medio) => (
                          <SelectItem key={medio} value={medio}>
                            {medio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fecha pago</label>
                    <Input
                      type="date"
                      value={fechaPago}
                      onChange={(event) => setFechaPago(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Referencia</label>
                    <Input
                      placeholder="Opcional"
                      value={referencia}
                      onChange={(event) => setReferencia(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Observacion</label>
                  <Textarea
                    placeholder="Opcional"
                    value={observacion}
                    onChange={(event) => setObservacion(event.target.value)}
                  />
                </div>

                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
                {success ? (
                  <p className="text-sm text-primary">{success}</p>
                ) : null}

                <Button type="submit" className="w-full" disabled={saving}>
                  <Save className="size-4" />
                  {saving ? "Guardando..." : "Registrar abono"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumen del cliente</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedCliente ? (
                <p className="text-sm text-muted-foreground">
                  Seleccione un cliente para ver su estado de cuenta.
                </p>
              ) : loadingEstado ? (
                <p className="text-sm text-muted-foreground">
                  Consultando estado de cuenta...
                </p>
              ) : estadoCuenta ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">
                      {estadoCuenta.cliente.nombre}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {estadoCuenta.cliente.documento || "Sin documento"}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <ResumenItem
                      label="Saldo actual"
                      value={estadoCuenta.resumen.saldoActual}
                    />
                    <ResumenItem
                      label="Total vendido"
                      value={estadoCuenta.resumen.totalVendidoCredito}
                    />
                    <ResumenItem
                      label="Total abonado"
                      value={estadoCuenta.resumen.totalAbonado}
                    />
                    <ResumenItem
                      label="Deuda pendiente"
                      value={estadoCuenta.resumen.deudaPendiente}
                    />
                    <ResumenItem
                      label="Deuda vencida"
                      value={estadoCuenta.resumen.deudaVencida}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No se pudo cargar el estado de cuenta.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Pagos registrados</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void Promise.all([loadPagos(), loadEstadoCuenta()])
              }
            >
              <RefreshCw className="size-4" />
              Actualizar
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando pagos...</p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha pago</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Medio</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Observacion</TableHead>
                      <TableHead className="text-right">Accion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagos.length ? (
                      pagos.map((pago) => (
                        <TableRow key={pago.id}>
                          <TableCell>{pago.id}</TableCell>
                          <TableCell className="font-medium">
                            {pago.cliente?.nombre ??
                              `Cliente ${pago.clienteId}`}
                          </TableCell>
                          <TableCell>{formatDate(pago.fechaPago)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(pago.monto)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{pago.medioPago}</Badge>
                          </TableCell>
                          <TableCell>{pago.referencia || "-"}</TableCell>
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
                          <TableCell className="max-w-48 truncate text-muted-foreground">
                            {pago.observacion || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {pago.estado === "VALIDO" ? (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => void handleAnularPago(pago)}
                                disabled={annullingId === pago.id}
                              >
                                <Ban className="size-4" />
                                {annullingId === pago.id
                                  ? "Anulando"
                                  : "Anular"}
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No hay pagos registrados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ResumenItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{formatCurrency(value)}</p>
    </div>
  );
}

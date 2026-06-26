"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, Save, Trash2 } from "lucide-react";
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
  CreateVentaPayload,
  Producto,
  VentaCredito,
} from "@/types/api";

type VentaItemForm = {
  localId: string;
  productoId: string;
  cantidad: string;
  precioUnitario: string;
};

const emptyItem = (): VentaItemForm => ({
  localId: crypto.randomUUID(),
  productoId: "",
  cantidad: "1",
  precioUnitario: "",
});

export default function VentasPage() {
  const [ventas, setVentas] = useState<VentaCredito[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [fechaCompromisoPago, setFechaCompromisoPago] = useState("");
  const [observacion, setObservacion] = useState("");
  const [items, setItems] = useState<VentaItemForm[]>([emptyItem()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const productosPorId = useMemo(
    () => new Map(productos.map((producto) => [producto.id, producto])),
    [productos],
  );

  const totalEstimado = useMemo(
    () =>
      items.reduce((total, item) => {
        const producto = productosPorId.get(Number(item.productoId));
        const cantidad = Number(item.cantidad);
        const precio = item.precioUnitario
          ? Number(item.precioUnitario)
          : Number(producto?.precioBase ?? 0);

        if (!Number.isFinite(cantidad) || !Number.isFinite(precio)) {
          return total;
        }

        return total + cantidad * precio;
      }, 0),
    [items, productosPorId],
  );

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [ventasResponse, clientesResponse, productosResponse] =
        await Promise.all([
          api.get<VentaCredito[]>("/ventas"),
          api.get<Cliente[]>("/clientes"),
          api.get<Producto[]>("/productos"),
        ]);

      setVentas(ventasResponse.data);
      setClientes(clientesResponse.data);
      setProductos(productosResponse.data);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, []);

  function updateItem(localId: string, patch: Partial<VentaItemForm>) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item,
      ),
    );
  }

  function removeItem(localId: string) {
    setItems((currentItems) =>
      currentItems.length === 1
        ? currentItems
        : currentItems.filter((item) => item.localId !== localId),
    );
  }

  function validatePayload(): CreateVentaPayload | null {
    if (!clienteId) {
      setError("Seleccione un cliente");
      return null;
    }

    const validItems = items.filter((item) => item.productoId);

    if (validItems.length === 0) {
      setError("Agregue al menos un producto");
      return null;
    }

    const payloadItems: CreateVentaPayload["items"] = [];

    for (const item of validItems) {
      const cantidad = Number(item.cantidad);
      const precioUnitario = item.precioUnitario
        ? Number(item.precioUnitario)
        : undefined;

      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        setError("La cantidad debe ser mayor a 0");
        return null;
      }

      if (
        precioUnitario !== undefined &&
        (!Number.isFinite(precioUnitario) || precioUnitario <= 0)
      ) {
        setError("El precio unitario debe ser mayor a 0");
        return null;
      }

      payloadItems.push({
        productoId: Number(item.productoId),
        cantidad,
        ...(precioUnitario !== undefined ? { precioUnitario } : {}),
      });
    }

    return {
      clienteId: Number(clienteId),
      ...(fechaCompromisoPago ? { fechaCompromisoPago } : {}),
      ...(observacion.trim() ? { observacion: observacion.trim() } : {}),
      items: payloadItems,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess("");
    setError("");

    const payload = validatePayload();

    if (!payload) {
      return;
    }

    try {
      setSaving(true);
      await api.post("/ventas", payload);
      setClienteId("");
      setFechaCompromisoPago("");
      setObservacion("");
      setItems([emptyItem()]);
      setSuccess("Venta a credito registrada correctamente");
      await loadData();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Ventas a credito"
        description="Registra ventas con saldo pendiente y revisa el historial de creditos."
      />

      <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nueva venta</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cliente</label>
                <Select
                  value={clienteId}
                  onValueChange={(value) => setClienteId(value ?? "")}
                >
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
                  <label className="text-sm font-medium">
                    Fecha compromiso
                  </label>
                  <Input
                    type="date"
                    value={fechaCompromisoPago}
                    onChange={(event) =>
                      setFechaCompromisoPago(event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Observacion</label>
                  <Input
                    placeholder="Opcional"
                    value={observacion}
                    onChange={(event) => setObservacion(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Productos</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setItems((current) => [...current, emptyItem()])
                    }
                  >
                    <Plus className="size-4" />
                    Agregar
                  </Button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => {
                    const producto = productosPorId.get(
                      Number(item.productoId),
                    );
                    const cantidad = Number(item.cantidad);
                    const precio = item.precioUnitario
                      ? Number(item.precioUnitario)
                      : Number(producto?.precioBase ?? 0);
                    const subtotal =
                      Number.isFinite(cantidad) && Number.isFinite(precio)
                        ? cantidad * precio
                        : 0;

                    return (
                      <div
                        key={item.localId}
                        className="rounded-md border bg-muted/20 p-3"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-medium">
                            Item {index + 1}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeItem(item.localId)}
                            disabled={items.length === 1}
                            title="Quitar item"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <div className="grid gap-3">
                          <Select
                            value={item.productoId}
                            onValueChange={(value) =>
                              updateItem(item.localId, {
                                productoId: value ?? "",
                              })
                            }
                          >
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue placeholder="Seleccionar producto" />
                            </SelectTrigger>
                            <SelectContent>
                              {productos.map((productoOption) => (
                                <SelectItem
                                  key={productoOption.id}
                                  value={`${productoOption.id}`}
                                >
                                  {productoOption.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Cantidad"
                              value={item.cantidad}
                              onChange={(event) =>
                                updateItem(item.localId, {
                                  cantidad: event.target.value,
                                })
                              }
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder={
                                producto
                                  ? `Precio base ${formatCurrency(producto.precioBase)}`
                                  : "Precio opcional"
                              }
                              value={item.precioUnitario}
                              onChange={(event) =>
                                updateItem(item.localId, {
                                  precioUnitario: event.target.value,
                                })
                              }
                            />
                            <div className="flex h-10 items-center rounded-md border bg-background px-3 text-sm font-medium">
                              {formatCurrency(subtotal)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Card className="bg-muted/30">
                <CardContent className="flex items-center justify-between p-4">
                  <span className="text-sm text-muted-foreground">
                    Total estimado
                  </span>
                  <span className="text-xl font-semibold">
                    {formatCurrency(totalEstimado)}
                  </span>
                </CardContent>
              </Card>

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              {success ? (
                <p className="text-sm text-primary">{success}</p>
              ) : null}

              <Button type="submit" className="w-full" disabled={saving}>
                <Save className="size-4" />
                {saving ? "Guardando..." : "Guardar venta"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ventas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">
                Cargando ventas...
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha venta</TableHead>
                      <TableHead>Compromiso</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Observacion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventas.length ? (
                      ventas.map((venta) => (
                        <TableRow key={venta.id}>
                          <TableCell>{venta.id}</TableCell>
                          <TableCell className="font-medium">
                            {venta.cliente?.nombre ??
                              `Cliente ${venta.clienteId}`}
                          </TableCell>
                          <TableCell>{formatDate(venta.fechaVenta)}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2">
                              <CalendarDays className="size-4 text-muted-foreground" />
                              {formatDate(venta.fechaCompromisoPago)}
                            </span>
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
                          <TableCell className="max-w-48 truncate text-muted-foreground">
                            {venta.observacion || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No hay ventas registradas
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

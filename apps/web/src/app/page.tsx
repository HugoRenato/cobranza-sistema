"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CalendarCheck,
  CircleDollarSign,
  Clock3,
  ReceiptText,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { DashboardCobranza } from "@/types/api";

const kpiConfig = [
  {
    label: "Total por cobrar",
    key: "totalPorCobrar",
    icon: CircleDollarSign,
  },
  {
    label: "Total vendido credito",
    key: "totalVendidoCredito",
    icon: TrendingUp,
  },
  {
    label: "Total abonado",
    key: "totalAbonado",
    icon: Banknote,
  },
  {
    label: "Clientes con deuda",
    key: "clientesConDeuda",
    icon: Users,
  },
  {
    label: "Ventas pendientes",
    key: "ventasPendientes",
    icon: ReceiptText,
  },
  {
    label: "Ventas vencidas",
    key: "ventasVencidas",
    icon: AlertCircle,
  },
  {
    label: "Deuda vencida",
    key: "deudaVencida",
    icon: Clock3,
  },
  {
    label: "Pagos del mes",
    key: "pagosDelMes",
    icon: CalendarCheck,
  },
] as const;

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardCobranza | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");
        const response = await api.get<DashboardCobranza>(
          "/dashboard/cobranza",
        );
        setDashboard(response.data);
      } catch (caughtError) {
        setError(getErrorMessage(caughtError));
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Resumen general de credito, cobranza y deuda."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiConfig.map((item) => (
            <Card key={item.key}>
              <CardContent className="h-28 animate-pulse bg-muted/50" />
            </Card>
          ))}
        </div>
      </>
    );
  }

  if (error || !dashboard) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Resumen general de credito, cobranza y deuda."
        />
        <Card>
          <CardContent className="py-8 text-sm text-destructive">
            No se pudo conectar con el API
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Resumen general de credito, cobranza y deuda."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiConfig.map((item) => {
          const Icon = item.icon;
          const value = dashboard.resumen[item.key];
          const isMoney =
            item.key.toLowerCase().includes("total") ||
            item.key.toLowerCase().includes("deuda") ||
            item.key.toLowerCase().includes("pagos");

          return (
            <Card key={item.key}>
              <CardContent className="flex h-28 items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-normal">
                    {isMoney ? formatCurrency(value) : value}
                  </p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top clientes deudores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dashboard.topClientesDeudores.map((item) => ({
                    nombre: item.cliente.nombre ?? `Cliente ${item.cliente.id}`,
                    deuda: item.deudaPendiente,
                  }))}
                  layout="vertical"
                  margin={{ left: 12, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => `S/ ${value}`}
                  />
                  <YAxis dataKey="nombre" type="category" width={120} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    labelClassName="text-foreground"
                  />
                  <Bar
                    dataKey="deuda"
                    fill="var(--primary)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Medio</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.pagosRecientes.map((pago) => (
                  <TableRow key={pago.id}>
                    <TableCell>{formatDate(pago.fechaPago)}</TableCell>
                    <TableCell>{pago.cliente.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{pago.medioPago}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(pago.monto)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Ventas recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.ventasRecientes.map((venta) => (
                  <TableRow key={venta.id}>
                    <TableCell>{formatDate(venta.fechaVenta)}</TableCell>
                    <TableCell>{venta.cliente.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{venta.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(venta.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(venta.saldoPendiente)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

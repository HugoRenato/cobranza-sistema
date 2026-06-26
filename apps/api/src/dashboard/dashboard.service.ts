import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AjusteVentaEstado,
  CompensacionEstado,
  PagoEstado,
  Prisma,
  VentaEstado,
  VentaOrigen,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type DashboardFiltros = {
  fechaDesde?: string;
  fechaHasta?: string;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getCobranza(filtros: DashboardFiltros) {
    const fechas = this.parseFechas(filtros);
    const hoy = new Date();
    const inicioDia = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate(),
      0,
      0,
      0,
      0,
    );
    const finDia = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate(),
      23,
      59,
      59,
      999,
    );
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(
      hoy.getFullYear(),
      hoy.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const ventaFechaWhere = this.buildFechaWhere('fechaVenta', fechas);
    const pagoFechaWhere = this.buildFechaWhere('fechaPago', fechas);
    const ventasConDeudaWhere: Prisma.VentaCreditoWhereInput = {
      ...ventaFechaWhere,
      estado: {
        in: [VentaEstado.PENDIENTE, VentaEstado.PARCIAL, VentaEstado.VENCIDA],
      },
      saldoPendiente: { gt: new Prisma.Decimal(0) },
    };
    const ventasVencidasWhere: Prisma.VentaCreditoWhereInput = {
      ...ventaFechaWhere,
      fechaCompromisoPago: { lt: inicioDia },
      saldoPendiente: { gt: new Prisma.Decimal(0) },
      estado: {
        notIn: [VentaEstado.PAGADA, VentaEstado.ANULADA],
      },
    };

    const [
      totalPorCobrar,
      totalVendidoCredito,
      totalAbonado,
      pagosDelDia,
      pagosDelMes,
      clientesConDeudaRows,
      ventasPendientes,
      ventasVencidas,
      deudaVencida,
      deudaPorCliente,
      cobranzaPorMedioPago,
      pagosParaEvolucion,
      ventasRecientes,
      pagosRecientes,
      totalCompensado,
      compensacionesValidas,
      deudaPorCompensaciones,
      totalAjustesPrecio,
    ] = await Promise.all([
      this.prisma.ventaCredito.aggregate({
        where: ventasConDeudaWhere,
        _sum: { saldoPendiente: true },
      }),
      this.prisma.ventaCredito.aggregate({
        where: {
          ...ventaFechaWhere,
          estado: { not: VentaEstado.ANULADA },
        },
        _sum: { total: true },
      }),
      this.prisma.pagoAbono.aggregate({
        where: {
          ...pagoFechaWhere,
          estado: PagoEstado.VALIDO,
        },
        _sum: { monto: true },
      }),
      this.prisma.pagoAbono.aggregate({
        where: {
          estado: PagoEstado.VALIDO,
          fechaPago: {
            gte: inicioDia,
            lte: finDia,
          },
        },
        _sum: { monto: true },
      }),
      this.prisma.pagoAbono.aggregate({
        where: {
          estado: PagoEstado.VALIDO,
          fechaPago: {
            gte: inicioMes,
            lte: finMes,
          },
        },
        _sum: { monto: true },
      }),
      this.prisma.ventaCredito.groupBy({
        by: ['clienteId'],
        where: ventasConDeudaWhere,
      }),
      this.prisma.ventaCredito.count({
        where: {
          ...ventaFechaWhere,
          estado: {
            in: [VentaEstado.PENDIENTE, VentaEstado.PARCIAL],
          },
        },
      }),
      this.prisma.ventaCredito.count({
        where: ventasVencidasWhere,
      }),
      this.prisma.ventaCredito.aggregate({
        where: ventasVencidasWhere,
        _sum: { saldoPendiente: true },
      }),
      this.prisma.ventaCredito.groupBy({
        by: ['clienteId'],
        where: ventasConDeudaWhere,
        _sum: { saldoPendiente: true },
      }),
      this.prisma.pagoAbono.groupBy({
        by: ['medioPago'],
        where: {
          ...pagoFechaWhere,
          estado: PagoEstado.VALIDO,
        },
        _sum: { monto: true },
        _count: { _all: true },
      }),
      this.prisma.pagoAbono.findMany({
        where: {
          ...pagoFechaWhere,
          estado: PagoEstado.VALIDO,
        },
        select: {
          fechaPago: true,
          monto: true,
        },
        orderBy: [{ fechaPago: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.ventaCredito.findMany({
        where: {
          ...ventaFechaWhere,
          estado: { not: VentaEstado.ANULADA },
        },
        include: {
          cliente: true,
        },
        orderBy: [{ fechaVenta: 'desc' }, { id: 'desc' }],
        take: 10,
      }),
      this.prisma.pagoAbono.findMany({
        where: {
          ...pagoFechaWhere,
          estado: PagoEstado.VALIDO,
        },
        include: {
          cliente: true,
        },
        orderBy: [{ fechaPago: 'desc' }, { id: 'desc' }],
        take: 10,
      }),
      this.prisma.compensacionCuenta.aggregate({
        where: {
          estado: CompensacionEstado.VALIDA,
          ...(fechas
            ? {
                fecha: {
                  ...(fechas.fechaDesde ? { gte: fechas.fechaDesde } : {}),
                  ...(fechas.fechaHasta ? { lte: fechas.fechaHasta } : {}),
                },
              }
            : {}),
        },
        _sum: { monto: true },
      }),
      this.prisma.compensacionCuenta.count({
        where: {
          estado: CompensacionEstado.VALIDA,
          ...(fechas
            ? {
                fecha: {
                  ...(fechas.fechaDesde ? { gte: fechas.fechaDesde } : {}),
                  ...(fechas.fechaHasta ? { lte: fechas.fechaHasta } : {}),
                },
              }
            : {}),
        },
      }),
      this.prisma.ventaCredito.aggregate({
        where: {
          ...ventaFechaWhere,
          origen: VentaOrigen.COMPENSACION,
          estado: {
            in: [
              VentaEstado.PENDIENTE,
              VentaEstado.PARCIAL,
              VentaEstado.VENCIDA,
            ],
          },
          saldoPendiente: { gt: new Prisma.Decimal(0) },
        },
        _sum: { saldoPendiente: true },
      }),
      this.prisma.ajusteVenta.aggregate({
        where: {
          estado: AjusteVentaEstado.VALIDO,
          ...(fechas
            ? {
                createdAt: {
                  ...(fechas.fechaDesde ? { gte: fechas.fechaDesde } : {}),
                  ...(fechas.fechaHasta ? { lte: fechas.fechaHasta } : {}),
                },
              }
            : {}),
        },
        _sum: { montoDiferencia: true },
      }),
    ]);

    const topClientesDeudores =
      await this.buildTopClientesDeudores(deudaPorCliente);

    return {
      resumen: {
        totalPorCobrar: this.decimalToNumber(
          totalPorCobrar._sum.saldoPendiente,
        ),
        totalVendidoCredito: this.decimalToNumber(
          totalVendidoCredito._sum.total,
        ),
        totalAbonado: this.decimalToNumber(totalAbonado._sum.monto),
        pagosDelDia: this.decimalToNumber(pagosDelDia._sum.monto),
        pagosDelMes: this.decimalToNumber(pagosDelMes._sum.monto),
        clientesConDeuda: clientesConDeudaRows.length,
        ventasPendientes,
        ventasVencidas,
        deudaVencida: this.decimalToNumber(deudaVencida._sum.saldoPendiente),
        totalCompensado: this.decimalToNumber(totalCompensado._sum.monto),
        compensacionesValidas,
        deudaPorCompensaciones: this.decimalToNumber(
          deudaPorCompensaciones._sum.saldoPendiente,
        ),
        totalAjustesPrecio: this.decimalToNumber(
          totalAjustesPrecio._sum.montoDiferencia,
        ),
      },
      topClientesDeudores,
      cobranzaPorMedioPago: cobranzaPorMedioPago.map((item) => ({
        medioPago: item.medioPago,
        total: this.decimalToNumber(item._sum.monto),
        cantidadPagos: item._count._all,
      })),
      evolucionDiariaPagos: this.buildEvolucionDiariaPagos(pagosParaEvolucion),
      ventasRecientes: ventasRecientes.map((venta) => ({
        id: venta.id,
        fechaVenta: venta.fechaVenta,
        cliente: {
          id: venta.cliente.id,
          nombre: venta.cliente.nombre,
          documento: venta.cliente.documento,
        },
        total: this.decimalToNumber(venta.total),
        saldoPendiente: this.decimalToNumber(venta.saldoPendiente),
        estado: venta.estado,
      })),
      pagosRecientes: pagosRecientes.map((pago) => ({
        id: pago.id,
        fechaPago: pago.fechaPago,
        cliente: {
          id: pago.cliente.id,
          nombre: pago.cliente.nombre,
          documento: pago.cliente.documento,
        },
        monto: this.decimalToNumber(pago.monto),
        medioPago: pago.medioPago,
        estado: pago.estado,
      })),
    };
  }

  private async buildTopClientesDeudores(
    deudaPorCliente: {
      clienteId: number;
      _sum: { saldoPendiente: Prisma.Decimal | null };
    }[],
  ) {
    const topDeudas = deudaPorCliente
      .map((item) => ({
        clienteId: item.clienteId,
        deudaPendiente: this.decimalToNumber(item._sum.saldoPendiente),
      }))
      .sort((a, b) => b.deudaPendiente - a.deudaPendiente)
      .slice(0, 5);

    const clientes = await this.prisma.cliente.findMany({
      where: {
        id: {
          in: topDeudas.map((item) => item.clienteId),
        },
      },
    });
    const clientesPorId = new Map(
      clientes.map((cliente) => [cliente.id, cliente]),
    );

    return topDeudas.map((item) => {
      const cliente = clientesPorId.get(item.clienteId);

      return {
        cliente: cliente
          ? {
              id: cliente.id,
              nombre: cliente.nombre,
              documento: cliente.documento,
              telefono: cliente.telefono,
            }
          : {
              id: item.clienteId,
              nombre: null,
              documento: null,
              telefono: null,
            },
        deudaPendiente: item.deudaPendiente,
      };
    });
  }

  private buildEvolucionDiariaPagos(
    pagos: { fechaPago: Date; monto: Prisma.Decimal }[],
  ) {
    const pagosPorDia = new Map<
      string,
      { total: number; cantidadPagos: number }
    >();

    for (const pago of pagos) {
      const fecha = this.formatDateOnly(pago.fechaPago);
      const acumulado = pagosPorDia.get(fecha) ?? {
        total: 0,
        cantidadPagos: 0,
      };
      acumulado.total += this.decimalToNumber(pago.monto);
      acumulado.cantidadPagos += 1;
      pagosPorDia.set(fecha, acumulado);
    }

    return [...pagosPorDia.entries()].map(([fecha, data]) => ({
      fecha,
      total: data.total,
      cantidadPagos: data.cantidadPagos,
    }));
  }

  private buildFechaWhere(
    campo: 'fechaVenta' | 'fechaPago',
    fechas:
      | {
          fechaDesde?: Date;
          fechaHasta?: Date;
        }
      | undefined,
  ) {
    if (!fechas) {
      return {};
    }

    return {
      [campo]: {
        ...(fechas.fechaDesde ? { gte: fechas.fechaDesde } : {}),
        ...(fechas.fechaHasta ? { lte: fechas.fechaHasta } : {}),
      },
    };
  }

  private parseFechas(filtros: DashboardFiltros) {
    const fechaDesde = this.parseFechaQuery(
      filtros.fechaDesde,
      'fechaDesde',
      false,
    );
    const fechaHasta = this.parseFechaQuery(
      filtros.fechaHasta,
      'fechaHasta',
      true,
    );

    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      throw new BadRequestException(
        'fechaDesde no puede ser mayor que fechaHasta',
      );
    }

    if (!fechaDesde && !fechaHasta) {
      return undefined;
    }

    return { fechaDesde, fechaHasta };
  }

  private parseFechaQuery(
    fecha: string | undefined,
    campo: string,
    finDelDia: boolean,
  ) {
    if (!fecha) {
      return undefined;
    }

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);

    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      const parsedDate = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        finDelDia ? 23 : 0,
        finDelDia ? 59 : 0,
        finDelDia ? 59 : 0,
        finDelDia ? 999 : 0,
      );

      if (
        parsedDate.getFullYear() !== Number(year) ||
        parsedDate.getMonth() !== Number(month) - 1 ||
        parsedDate.getDate() !== Number(day)
      ) {
        throw new BadRequestException(`${campo} no es valida`);
      }

      return parsedDate;
    }

    const parsedDate = new Date(fecha);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(`${campo} no es valida`);
    }

    return parsedDate;
  }

  private formatDateOnly(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private decimalToNumber(value: Prisma.Decimal | null | undefined) {
    return value ? value.toNumber() : 0;
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PagoEstado, Prisma, VentaEstado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type EstadoCuentaFiltros = {
  fechaDesde?: string;
  fechaHasta?: string;
};

@Injectable()
export class EstadoCuentaService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCliente(clienteId: number, filtros: EstadoCuentaFiltros) {
    const fechas = this.parseFechas(filtros);

    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con id ${clienteId} no encontrado`);
    }

    const movimientosWhere: Prisma.MovimientoCuentaClienteWhereInput = {
      clienteId,
      ...(fechas
        ? {
            createdAt: {
              ...(fechas.fechaDesde ? { gte: fechas.fechaDesde } : {}),
              ...(fechas.fechaHasta ? { lte: fechas.fechaHasta } : {}),
            },
          }
        : {}),
    };

    const [
      ultimoMovimiento,
      totalVendidoCredito,
      totalAbonado,
      deudaVencida,
      ventasPendientes,
      pagos,
      movimientos,
    ] = await Promise.all([
      this.prisma.movimientoCuentaCliente.findFirst({
        where: { clienteId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.ventaCredito.aggregate({
        where: {
          clienteId,
          estado: { not: VentaEstado.ANULADA },
        },
        _sum: { total: true },
      }),
      this.prisma.pagoAbono.aggregate({
        where: {
          clienteId,
          estado: PagoEstado.VALIDO,
        },
        _sum: { monto: true },
      }),
      this.prisma.ventaCredito.aggregate({
        where: {
          clienteId,
          fechaCompromisoPago: { lt: new Date() },
          saldoPendiente: { gt: new Prisma.Decimal(0) },
        },
        _sum: { saldoPendiente: true },
      }),
      this.prisma.ventaCredito.findMany({
        where: {
          clienteId,
          estado: {
            in: [
              VentaEstado.PENDIENTE,
              VentaEstado.PARCIAL,
              VentaEstado.VENCIDA,
            ],
          },
          saldoPendiente: { gt: new Prisma.Decimal(0) },
        },
        include: {
          detalles: {
            include: {
              producto: true,
            },
          },
        },
        orderBy: [{ fechaVenta: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.pagoAbono.findMany({
        where: {
          clienteId,
          estado: PagoEstado.VALIDO,
        },
        include: {
          aplicaciones: {
            include: {
              venta: true,
            },
          },
        },
        orderBy: [{ fechaPago: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.movimientoCuentaCliente.findMany({
        where: movimientosWhere,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const saldoActual = this.decimalToNumber(ultimoMovimiento?.saldo);

    return {
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        documento: cliente.documento,
        telefono: cliente.telefono,
      },
      resumen: {
        saldoActual,
        totalVendidoCredito: this.decimalToNumber(
          totalVendidoCredito._sum.total,
        ),
        totalAbonado: this.decimalToNumber(totalAbonado._sum.monto),
        deudaPendiente: saldoActual,
        deudaVencida: this.decimalToNumber(deudaVencida._sum.saldoPendiente),
        cantidadVentasPendientes: ventasPendientes.length,
        cantidadPagos: pagos.length,
      },
      ventasPendientes: ventasPendientes.map((venta) => ({
        ...venta,
        total: this.decimalToNumber(venta.total),
        saldoPendiente: this.decimalToNumber(venta.saldoPendiente),
        detalles: venta.detalles.map((detalle) => ({
          ...detalle,
          cantidad: this.decimalToNumber(detalle.cantidad),
          precioUnitario: this.decimalToNumber(detalle.precioUnitario),
          subtotal: this.decimalToNumber(detalle.subtotal),
          producto: {
            ...detalle.producto,
            precioBase: this.decimalToNumber(detalle.producto.precioBase),
            stock: this.decimalToNumberOrNull(detalle.producto.stock),
          },
        })),
      })),
      pagos: pagos.map((pago) => ({
        ...pago,
        monto: this.decimalToNumber(pago.monto),
        aplicaciones: pago.aplicaciones.map((aplicacion) => ({
          ...aplicacion,
          monto: this.decimalToNumber(aplicacion.monto),
          venta: {
            ...aplicacion.venta,
            total: this.decimalToNumber(aplicacion.venta.total),
            saldoPendiente: this.decimalToNumber(
              aplicacion.venta.saldoPendiente,
            ),
          },
        })),
      })),
      movimientos: movimientos.map((movimiento) => ({
        id: movimiento.id,
        fecha: movimiento.createdAt,
        tipo: movimiento.tipo,
        descripcion: movimiento.descripcion,
        cargo: this.decimalToNumber(movimiento.cargo),
        abono: this.decimalToNumber(movimiento.abono),
        saldo: this.decimalToNumber(movimiento.saldo),
      })),
    };
  }

  private parseFechas(filtros: EstadoCuentaFiltros) {
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

  private decimalToNumber(value: Prisma.Decimal | null | undefined) {
    return value ? value.toNumber() : 0;
  }

  private decimalToNumberOrNull(value: Prisma.Decimal | null) {
    return value ? value.toNumber() : null;
  }
}

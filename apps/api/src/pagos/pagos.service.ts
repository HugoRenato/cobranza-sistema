import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PagoEstado, Prisma, TipoMovimientoCuenta, VentaEstado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePagoDto } from './dto/create-pago.dto';

const pagoInclude = {
  cliente: true,
  aplicaciones: {
    include: {
      venta: true,
    },
  },
  movimiento: true,
};

@Injectable()
export class PagosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.pagoAbono.findMany({
      include: pagoInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const pago = await this.prisma.pagoAbono.findUnique({
      where: { id },
      include: pagoInclude,
    });

    if (!pago) {
      throw new NotFoundException(`Pago con id ${id} no encontrado`);
    }

    return pago;
  }

  async findByCliente(clienteId: number) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con id ${clienteId} no encontrado`);
    }

    return this.prisma.pagoAbono.findMany({
      where: { clienteId },
      include: pagoInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(createPagoDto: CreatePagoDto) {
    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findFirst({
        where: {
          id: createPagoDto.clienteId,
          activo: true,
        },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado o inactivo');
      }

      const monto = new Prisma.Decimal(createPagoDto.monto);

      if (monto.lessThanOrEqualTo(0)) {
        throw new BadRequestException('El monto debe ser mayor a 0');
      }

      const ultimoMovimiento = await tx.movimientoCuentaCliente.findFirst({
        where: { clienteId: createPagoDto.clienteId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const saldoAnterior = ultimoMovimiento?.saldo ?? new Prisma.Decimal(0);

      if (saldoAnterior.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'El cliente no tiene saldo pendiente para registrar un pago',
        );
      }

      if (monto.greaterThan(saldoAnterior)) {
        throw new BadRequestException(
          'El monto del pago no puede ser mayor al saldo pendiente del cliente',
        );
      }

      const ventasPendientes = await tx.ventaCredito.findMany({
        where: {
          clienteId: createPagoDto.clienteId,
          estado: {
            in: [VentaEstado.PENDIENTE, VentaEstado.PARCIAL],
          },
          saldoPendiente: {
            gt: new Prisma.Decimal(0),
          },
        },
        orderBy: [{ fechaVenta: 'asc' }, { id: 'asc' }],
      });

      if (ventasPendientes.length === 0) {
        throw new ConflictException(
          'El cliente no tiene ventas pendientes para aplicar el pago',
        );
      }

      const fechaPago = this.parseFechaPago(createPagoDto.fechaPago);
      const pago = await tx.pagoAbono.create({
        data: {
          clienteId: createPagoDto.clienteId,
          monto,
          medioPago: createPagoDto.medioPago,
          fechaPago,
          referencia: createPagoDto.referencia,
          observacion: createPagoDto.observacion,
          estado: PagoEstado.VALIDO,
        },
      });

      let montoDisponible = monto;

      for (const venta of ventasPendientes) {
        if (montoDisponible.lessThanOrEqualTo(0)) {
          break;
        }

        const montoAplicado = montoDisponible.greaterThan(venta.saldoPendiente)
          ? venta.saldoPendiente
          : montoDisponible;
        const nuevoSaldoVenta = venta.saldoPendiente.minus(montoAplicado);

        await tx.pagoAplicacion.create({
          data: {
            pagoId: pago.id,
            ventaId: venta.id,
            monto: montoAplicado,
          },
        });

        await tx.ventaCredito.update({
          where: { id: venta.id },
          data: {
            saldoPendiente: nuevoSaldoVenta,
            estado: nuevoSaldoVenta.equals(0)
              ? VentaEstado.PAGADA
              : VentaEstado.PARCIAL,
          },
        });

        montoDisponible = montoDisponible.minus(montoAplicado);
      }

      if (montoDisponible.greaterThan(0)) {
        throw new ConflictException(
          'No hay ventas pendientes suficientes para aplicar todo el pago',
        );
      }

      await tx.movimientoCuentaCliente.create({
        data: {
          clienteId: createPagoDto.clienteId,
          pagoId: pago.id,
          tipo: TipoMovimientoCuenta.ABONO,
          descripcion: 'Abono registrado',
          cargo: new Prisma.Decimal(0),
          abono: monto,
          saldo: saldoAnterior.minus(monto),
        },
      });

      return tx.pagoAbono.findUnique({
        where: { id: pago.id },
        include: pagoInclude,
      });
    });
  }

  private parseFechaPago(fecha?: string) {
    if (!fecha) {
      return undefined;
    }

    const parsedDate = new Date(fecha);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('fechaPago no es valida');
    }

    return parsedDate;
  }
}

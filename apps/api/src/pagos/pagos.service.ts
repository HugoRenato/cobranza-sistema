import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PagoEstado,
  Prisma,
  TipoMovimientoCuenta,
  VentaEstado,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
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
  private readonly logger = new Logger(PagosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

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

  async create(createPagoDto: CreatePagoDto) {
    const pagoCreado = await this.prisma.$transaction(async (tx) => {
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
            in: [
              VentaEstado.PENDIENTE,
              VentaEstado.PARCIAL,
              VentaEstado.VENCIDA,
            ],
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

    await this.crearMensajeAbonoSeguro(pagoCreado?.id);

    return pagoCreado;
  }

  async anular(id: number) {
    const pagoAnulado = await this.prisma.$transaction(async (tx) => {
      const pago = await tx.pagoAbono.findUnique({
        where: { id },
        include: pagoInclude,
      });

      if (!pago) {
        throw new NotFoundException(`Pago con id ${id} no encontrado`);
      }

      if (pago.estado === PagoEstado.ANULADO) {
        throw new BadRequestException(`Pago con id ${id} ya esta anulado`);
      }

      if (pago.estado !== PagoEstado.VALIDO) {
        throw new BadRequestException('Solo se pueden anular pagos validos');
      }

      const ultimoMovimiento = await tx.movimientoCuentaCliente.findFirst({
        where: { clienteId: pago.clienteId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const saldoAnterior = ultimoMovimiento?.saldo ?? new Prisma.Decimal(0);

      const aplicacionesPorVenta = new Map<
        number,
        {
          venta: (typeof pago.aplicaciones)[number]['venta'];
          monto: Prisma.Decimal;
        }
      >();

      for (const aplicacion of pago.aplicaciones) {
        const acumulado = aplicacionesPorVenta.get(aplicacion.ventaId);

        aplicacionesPorVenta.set(aplicacion.ventaId, {
          venta: aplicacion.venta,
          monto: (acumulado?.monto ?? new Prisma.Decimal(0)).plus(
            aplicacion.monto,
          ),
        });
      }

      for (const [ventaId, aplicacion] of aplicacionesPorVenta) {
        const nuevoSaldoVenta = aplicacion.venta.saldoPendiente.plus(
          aplicacion.monto,
        );
        const nuevoEstadoVenta = this.getEstadoVentaPorSaldo(
          nuevoSaldoVenta,
          aplicacion.venta.total,
        );

        await tx.ventaCredito.update({
          where: { id: ventaId },
          data: {
            saldoPendiente: nuevoSaldoVenta,
            estado: nuevoEstadoVenta,
          },
        });
      }

      await tx.pagoAbono.update({
        where: { id },
        data: { estado: PagoEstado.ANULADO },
      });

      await tx.movimientoCuentaCliente.create({
        data: {
          clienteId: pago.clienteId,
          ...(pago.movimiento ? {} : { pagoId: pago.id }),
          tipo: TipoMovimientoCuenta.ANULACION,
          descripcion: `Anulación de abono #${pago.id}`,
          cargo: pago.monto,
          abono: new Prisma.Decimal(0),
          saldo: saldoAnterior.plus(pago.monto),
        },
      });

      return tx.pagoAbono.findUnique({
        where: { id },
        include: pagoInclude,
      });
    });

    await this.crearMensajeAnulacionPagoSeguro(pagoAnulado?.id);

    return pagoAnulado;
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

  private getEstadoVentaPorSaldo(
    saldoPendiente: Prisma.Decimal,
    total: Prisma.Decimal,
  ) {
    if (saldoPendiente.equals(0)) {
      return VentaEstado.PAGADA;
    }

    if (saldoPendiente.equals(total) || saldoPendiente.greaterThan(total)) {
      return VentaEstado.PENDIENTE;
    }

    return VentaEstado.PARCIAL;
  }

  private async crearMensajeAbonoSeguro(pagoId?: number) {
    if (!pagoId) {
      return;
    }

    try {
      await this.whatsappService.crearMensajeAbono(pagoId);
    } catch (error) {
      this.logger.warn(
        `No se pudo crear mensaje WhatsApp para pago ${pagoId}: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private async crearMensajeAnulacionPagoSeguro(pagoId?: number) {
    if (!pagoId) {
      return;
    }

    try {
      await this.whatsappService.crearMensajeAnulacionPago(pagoId);
    } catch (error) {
      this.logger.warn(
        `No se pudo crear mensaje WhatsApp de anulacion para pago ${pagoId}: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompensacionEstado,
  PagoEstado,
  Prisma,
  TipoMovimientoCuenta,
  UnidadNegocio,
  VentaEstado,
  VentaOrigen,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompensacionDto } from './dto/create-compensacion.dto';

const compensacionListInclude = {
  clienteOrigen: true,
  cuentaDestino: true,
  ventaDestino: true,
  aplicaciones: true,
};

const compensacionDetailInclude = {
  clienteOrigen: true,
  cuentaDestino: true,
  ventaDestino: {
    include: {
      pagosAplicados: {
        include: {
          pago: true,
        },
      },
    },
  },
  aplicaciones: {
    include: {
      venta: true,
    },
  },
  movimientos: true,
};

@Injectable()
export class CompensacionesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.compensacionCuenta.findMany({
      include: compensacionListInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const compensacion = await this.prisma.compensacionCuenta.findUnique({
      where: { id },
      include: compensacionDetailInclude,
    });

    if (!compensacion) {
      throw new NotFoundException(`Compensación con id ${id} no encontrada`);
    }

    return compensacion;
  }

  findByCliente(clienteId: number) {
    return this.prisma.compensacionCuenta.findMany({
      where: {
        OR: [{ clienteOrigenId: clienteId }, { cuentaDestinoId: clienteId }],
      },
      include: {
        clienteOrigen: true,
        cuentaDestino: true,
        ventaDestino: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(createCompensacionDto: CreateCompensacionDto) {
    return this.prisma.$transaction(async (tx) => {
      if (
        createCompensacionDto.clienteOrigenId ===
        createCompensacionDto.cuentaDestinoId
      ) {
        throw new BadRequestException(
          'El cliente origen no puede ser igual a la cuenta destino',
        );
      }

      const monto = new Prisma.Decimal(createCompensacionDto.monto);

      if (monto.lessThanOrEqualTo(0)) {
        throw new BadRequestException('El monto debe ser mayor a 0');
      }

      const [clienteOrigen, cuentaDestino] = await Promise.all([
        tx.cliente.findFirst({
          where: { id: createCompensacionDto.clienteOrigenId, activo: true },
        }),
        tx.cliente.findFirst({
          where: { id: createCompensacionDto.cuentaDestinoId, activo: true },
        }),
      ]);

      if (!clienteOrigen) {
        throw new NotFoundException('Cliente origen no encontrado o inactivo');
      }

      if (!cuentaDestino) {
        throw new NotFoundException('Cuenta destino no encontrada o inactiva');
      }

      const [ultimoMovimientoOrigen, ultimoMovimientoDestino] =
        await Promise.all([
          tx.movimientoCuentaCliente.findFirst({
            where: { clienteId: createCompensacionDto.clienteOrigenId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          }),
          tx.movimientoCuentaCliente.findFirst({
            where: { clienteId: createCompensacionDto.cuentaDestinoId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          }),
        ]);
      const saldoAnteriorOrigen =
        ultimoMovimientoOrigen?.saldo ?? new Prisma.Decimal(0);
      const saldoAnteriorDestino =
        ultimoMovimientoDestino?.saldo ?? new Prisma.Decimal(0);

      if (saldoAnteriorOrigen.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'El cliente origen no tiene saldo pendiente para compensar',
        );
      }

      if (monto.greaterThan(saldoAnteriorOrigen)) {
        throw new BadRequestException(
          'El monto de la compensación no puede ser mayor al saldo pendiente del cliente origen',
        );
      }

      const fecha = this.parseFecha(createCompensacionDto.fecha);
      const ventasPendientes = await tx.ventaCredito.findMany({
        where: {
          clienteId: createCompensacionDto.clienteOrigenId,
          estado: {
            in: [
              VentaEstado.PENDIENTE,
              VentaEstado.PARCIAL,
              VentaEstado.VENCIDA,
            ],
          },
          saldoPendiente: { gt: new Prisma.Decimal(0) },
        },
        orderBy: [{ fechaVenta: 'asc' }, { id: 'asc' }],
      });

      if (ventasPendientes.length === 0) {
        throw new BadRequestException(
          'El cliente origen no tiene ventas pendientes para aplicar la compensación',
        );
      }

      const ventaDestino = await tx.ventaCredito.create({
        data: {
          clienteId: createCompensacionDto.cuentaDestinoId,
          fechaVenta: fecha,
          total: monto,
          saldoPendiente: monto,
          estado: VentaEstado.PENDIENTE,
          origen: VentaOrigen.COMPENSACION,
          observacion: `Deuda asumida por compensación del cliente ${clienteOrigen.nombre}. Motivo: ${createCompensacionDto.motivo}`,
        },
      });

      const compensacion = await tx.compensacionCuenta.create({
        data: {
          clienteOrigenId: createCompensacionDto.clienteOrigenId,
          cuentaDestinoId: createCompensacionDto.cuentaDestinoId,
          ventaDestinoId: ventaDestino.id,
          monto,
          unidadNegocio:
            createCompensacionDto.unidadNegocio ??
            UnidadNegocio.TIENDA_ABARROTES,
          fecha,
          motivo: createCompensacionDto.motivo,
          referencia: createCompensacionDto.referencia,
          observacion: createCompensacionDto.observacion,
          estado: CompensacionEstado.VALIDA,
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

        await tx.compensacionAplicacion.create({
          data: {
            compensacionId: compensacion.id,
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
        throw new BadRequestException(
          'No hay ventas pendientes suficientes para aplicar toda la compensación',
        );
      }

      await tx.movimientoCuentaCliente.create({
        data: {
          clienteId: createCompensacionDto.clienteOrigenId,
          compensacionId: compensacion.id,
          tipo: TipoMovimientoCuenta.COMPENSACION_ABONO,
          descripcion: `Compensación trasladada a ${cuentaDestino.nombre}`,
          cargo: new Prisma.Decimal(0),
          abono: monto,
          saldo: saldoAnteriorOrigen.minus(monto),
          createdAt: fecha,
        },
      });

      await tx.movimientoCuentaCliente.create({
        data: {
          clienteId: createCompensacionDto.cuentaDestinoId,
          ventaId: ventaDestino.id,
          compensacionId: compensacion.id,
          tipo: TipoMovimientoCuenta.COMPENSACION_CARGO,
          descripcion: `Deuda asumida por compensación del cliente ${clienteOrigen.nombre}`,
          cargo: monto,
          abono: new Prisma.Decimal(0),
          saldo: saldoAnteriorDestino.plus(monto),
          createdAt: fecha,
        },
      });

      return tx.compensacionCuenta.findUnique({
        where: { id: compensacion.id },
        include: compensacionDetailInclude,
      });
    });
  }

  anular(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const compensacion = await tx.compensacionCuenta.findUnique({
        where: { id },
        include: compensacionDetailInclude,
      });

      if (!compensacion) {
        throw new NotFoundException(`Compensación con id ${id} no encontrada`);
      }

      if (compensacion.estado === CompensacionEstado.ANULADA) {
        throw new BadRequestException(
          `Compensación con id ${id} ya está anulada`,
        );
      }

      const tienePagosValidosDestino =
        compensacion.ventaDestino?.pagosAplicados.some(
          (aplicacion) => aplicacion.pago.estado === PagoEstado.VALIDO,
        ) ?? false;

      if (tienePagosValidosDestino) {
        throw new BadRequestException(
          'No se puede anular la compensación porque la cuenta destino ya tiene pagos aplicados.',
        );
      }

      const [ultimoMovimientoOrigen, ultimoMovimientoDestino] =
        await Promise.all([
          tx.movimientoCuentaCliente.findFirst({
            where: { clienteId: compensacion.clienteOrigenId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          }),
          tx.movimientoCuentaCliente.findFirst({
            where: { clienteId: compensacion.cuentaDestinoId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          }),
        ]);
      const saldoAnteriorOrigen =
        ultimoMovimientoOrigen?.saldo ?? new Prisma.Decimal(0);
      const saldoAnteriorDestino =
        ultimoMovimientoDestino?.saldo ?? new Prisma.Decimal(0);

      for (const aplicacion of compensacion.aplicaciones) {
        const nuevoSaldoVenta = aplicacion.venta.saldoPendiente.plus(
          aplicacion.monto,
        );

        await tx.ventaCredito.update({
          where: { id: aplicacion.ventaId },
          data: {
            saldoPendiente: nuevoSaldoVenta,
            estado: this.getEstadoVentaPorSaldo(
              nuevoSaldoVenta,
              aplicacion.venta.total,
            ),
          },
        });
      }

      if (compensacion.ventaDestinoId) {
        await tx.ventaCredito.update({
          where: { id: compensacion.ventaDestinoId },
          data: {
            estado: VentaEstado.ANULADA,
            saldoPendiente: new Prisma.Decimal(0),
          },
        });
      }

      await tx.compensacionCuenta.update({
        where: { id },
        data: { estado: CompensacionEstado.ANULADA },
      });

      await tx.movimientoCuentaCliente.create({
        data: {
          clienteId: compensacion.clienteOrigenId,
          compensacionId: compensacion.id,
          tipo: TipoMovimientoCuenta.ANULACION,
          descripcion: `Anulación de compensación #${compensacion.id}`,
          cargo: compensacion.monto,
          abono: new Prisma.Decimal(0),
          saldo: saldoAnteriorOrigen.plus(compensacion.monto),
        },
      });

      await tx.movimientoCuentaCliente.create({
        data: {
          clienteId: compensacion.cuentaDestinoId,
          compensacionId: compensacion.id,
          tipo: TipoMovimientoCuenta.ANULACION,
          descripcion: `Anulación de deuda asumida por compensación #${compensacion.id}`,
          cargo: new Prisma.Decimal(0),
          abono: compensacion.monto,
          saldo: saldoAnteriorDestino.minus(compensacion.monto),
        },
      });

      return tx.compensacionCuenta.findUnique({
        where: { id },
        include: compensacionDetailInclude,
      });
    });
  }

  private parseFecha(fecha?: string) {
    if (!fecha) {
      return new Date();
    }

    const parsedDate = new Date(fecha);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('fecha no es válida');
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
}

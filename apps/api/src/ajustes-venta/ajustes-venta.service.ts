import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AjusteVentaEstado,
  AjusteVentaTipo,
  Prisma,
  TipoMovimientoCuenta,
  VentaEstado,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAjustePrecioDto } from './dto/create-ajuste-precio.dto';

const ajusteListInclude = {
  cliente: true,
  venta: true,
  ventaDetalle: {
    include: {
      producto: true,
    },
  },
};

const ajusteDetailInclude = {
  cliente: true,
  venta: {
    include: {
      cliente: true,
      detalles: {
        include: {
          producto: true,
        },
      },
    },
  },
  ventaDetalle: {
    include: {
      producto: true,
    },
  },
  movimientos: true,
};

@Injectable()
export class AjustesVentaService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.ajusteVenta.findMany({
      include: ajusteListInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const ajuste = await this.prisma.ajusteVenta.findUnique({
      where: { id },
      include: ajusteDetailInclude,
    });

    if (!ajuste) {
      throw new NotFoundException(`Ajuste de venta con id ${id} no encontrado`);
    }

    return ajuste;
  }

  async findByVenta(ventaId: number) {
    const venta = await this.prisma.ventaCredito.findUnique({
      where: { id: ventaId },
    });

    if (!venta) {
      throw new NotFoundException(`Venta con id ${ventaId} no encontrada`);
    }

    return this.prisma.ajusteVenta.findMany({
      where: { ventaId },
      include: ajusteListInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCliente(clienteId: number) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con id ${clienteId} no encontrado`);
    }

    return this.prisma.ajusteVenta.findMany({
      where: { clienteId },
      include: ajusteListInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  ajustarPrecio(createAjustePrecioDto: CreateAjustePrecioDto) {
    return this.prisma.$transaction(async (tx) => {
      const precioNuevo = new Prisma.Decimal(createAjustePrecioDto.precioNuevo);

      if (precioNuevo.lessThanOrEqualTo(0)) {
        throw new BadRequestException('El precio nuevo debe ser mayor a 0');
      }

      const venta = await tx.ventaCredito.findUnique({
        where: { id: createAjustePrecioDto.ventaId },
        include: {
          cliente: true,
          detalles: {
            include: {
              producto: true,
            },
          },
        },
      });

      if (!venta) {
        throw new NotFoundException(
          `Venta con id ${createAjustePrecioDto.ventaId} no encontrada`,
        );
      }

      if (venta.estado === VentaEstado.ANULADA) {
        throw new BadRequestException('No se puede ajustar una venta anulada');
      }

      if (!venta.cliente) {
        throw new BadRequestException('La venta no tiene cliente asociado');
      }

      const detalle = this.resolveDetalle(
        venta.detalles,
        createAjustePrecioDto.ventaDetalleId,
      );
      const precioAnterior = detalle.precioUnitario;
      const cantidadAfectada = detalle.cantidad;
      const diferenciaUnitario = precioAnterior.minus(precioNuevo);
      const montoDiferencia = diferenciaUnitario.mul(cantidadAfectada);

      if (montoDiferencia.equals(0)) {
        throw new BadRequestException(
          'El precio nuevo no genera diferencia en la venta',
        );
      }

      if (
        montoDiferencia.greaterThan(0) &&
        montoDiferencia.greaterThan(venta.saldoPendiente)
      ) {
        throw new BadRequestException(
          'El ajuste supera el saldo pendiente de la venta. Se requiere manejo de saldo a favor.',
        );
      }

      const nuevoSubtotal = precioNuevo.mul(cantidadAfectada);
      const nuevoTotal = venta.detalles.reduce((total, item) => {
        return total.plus(
          item.id === detalle.id ? nuevoSubtotal : item.subtotal,
        );
      }, new Prisma.Decimal(0));
      const nuevoSaldoPendiente = venta.saldoPendiente.minus(montoDiferencia);

      await tx.ventaDetalle.update({
        where: { id: detalle.id },
        data: {
          precioUnitario: precioNuevo,
          subtotal: nuevoSubtotal,
        },
      });

      await tx.ventaCredito.update({
        where: { id: venta.id },
        data: {
          total: nuevoTotal,
          saldoPendiente: nuevoSaldoPendiente,
          estado: this.getEstadoVentaPorSaldo(nuevoSaldoPendiente, nuevoTotal),
        },
      });

      const ajuste = await tx.ajusteVenta.create({
        data: {
          ventaId: venta.id,
          ventaDetalleId: detalle.id,
          clienteId: venta.clienteId,
          tipo: AjusteVentaTipo.PRECIO_UNITARIO,
          estado: AjusteVentaEstado.VALIDO,
          precioAnterior,
          precioNuevo,
          cantidadAfectada,
          montoDiferencia,
          motivo: createAjustePrecioDto.motivo,
          observacion: createAjustePrecioDto.observacion,
        },
      });

      const ultimoMovimiento = await tx.movimientoCuentaCliente.findFirst({
        where: { clienteId: venta.clienteId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const saldoAnteriorCliente =
        ultimoMovimiento?.saldo ?? new Prisma.Decimal(0);
      const movimiento = this.buildMovimientoAjustePrecio({
        ajusteId: ajuste.id,
        clienteId: venta.clienteId,
        ventaId: venta.id,
        precioAnterior,
        precioNuevo,
        montoDiferencia,
        saldoAnteriorCliente,
      });

      await tx.movimientoCuentaCliente.create({ data: movimiento });

      return tx.ajusteVenta.findUnique({
        where: { id: ajuste.id },
        include: ajusteDetailInclude,
      });
    });
  }

  anular(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const ajuste = await tx.ajusteVenta.findUnique({
        where: { id },
        include: ajusteDetailInclude,
      });

      if (!ajuste) {
        throw new NotFoundException(
          `Ajuste de venta con id ${id} no encontrado`,
        );
      }

      if (ajuste.estado === AjusteVentaEstado.ANULADO) {
        throw new BadRequestException(
          `Ajuste de venta con id ${id} ya está anulado`,
        );
      }

      if (ajuste.venta.estado === VentaEstado.ANULADA) {
        throw new BadRequestException(
          'No se puede anular un ajuste de una venta anulada',
        );
      }

      if (
        ajuste.tipo !== AjusteVentaTipo.PRECIO_UNITARIO ||
        !ajuste.ventaDetalleId ||
        !ajuste.ventaDetalle ||
        !ajuste.precioAnterior ||
        !ajuste.cantidadAfectada
      ) {
        throw new BadRequestException(
          'Solo se puede anular automáticamente un ajuste de precio unitario completo',
        );
      }

      const ventaDetalleId = ajuste.ventaDetalleId;
      const subtotalAnterior = ajuste.precioAnterior.mul(
        ajuste.cantidadAfectada,
      );
      const saldoRevertido = ajuste.venta.saldoPendiente.plus(
        ajuste.montoDiferencia,
      );
      const totalRevertido = ajuste.venta.detalles.reduce((total, detalle) => {
        return total.plus(
          detalle.id === ajuste.ventaDetalleId
            ? subtotalAnterior
            : detalle.subtotal,
        );
      }, new Prisma.Decimal(0));

      if (saldoRevertido.lessThan(0)) {
        throw new BadRequestException(
          'La anulación del ajuste dejaría saldo pendiente negativo',
        );
      }

      await tx.ventaDetalle.update({
        where: { id: ventaDetalleId },
        data: {
          precioUnitario: ajuste.precioAnterior,
          subtotal: subtotalAnterior,
        },
      });

      await tx.ventaCredito.update({
        where: { id: ajuste.ventaId },
        data: {
          total: totalRevertido,
          saldoPendiente: saldoRevertido,
          estado: this.getEstadoVentaPorSaldo(saldoRevertido, totalRevertido),
        },
      });

      await tx.ajusteVenta.update({
        where: { id },
        data: { estado: AjusteVentaEstado.ANULADO },
      });

      const ultimoMovimiento = await tx.movimientoCuentaCliente.findFirst({
        where: { clienteId: ajuste.clienteId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const saldoAnteriorCliente =
        ultimoMovimiento?.saldo ?? new Prisma.Decimal(0);
      const montoAbs = ajuste.montoDiferencia.abs();
      const redujoDeuda = ajuste.montoDiferencia.greaterThan(0);

      await tx.movimientoCuentaCliente.create({
        data: {
          clienteId: ajuste.clienteId,
          ventaId: ajuste.ventaId,
          ajusteVentaId: ajuste.id,
          tipo: TipoMovimientoCuenta.ANULACION,
          descripcion: `Anulación de ajuste de precio #${ajuste.id}`,
          cargo: redujoDeuda ? montoAbs : new Prisma.Decimal(0),
          abono: redujoDeuda ? new Prisma.Decimal(0) : montoAbs,
          saldo: redujoDeuda
            ? saldoAnteriorCliente.plus(montoAbs)
            : saldoAnteriorCliente.minus(montoAbs),
        },
      });

      return tx.ajusteVenta.findUnique({
        where: { id },
        include: ajusteDetailInclude,
      });
    });
  }

  private resolveDetalle(
    detalles: {
      id: number;
      precioUnitario: Prisma.Decimal;
      cantidad: Prisma.Decimal;
      subtotal: Prisma.Decimal;
    }[],
    ventaDetalleId?: number,
  ) {
    if (ventaDetalleId) {
      const detalle = detalles.find((item) => item.id === ventaDetalleId);

      if (!detalle) {
        throw new BadRequestException(
          'El detalle indicado no pertenece a la venta',
        );
      }

      return detalle;
    }

    if (detalles.length !== 1) {
      throw new BadRequestException(
        'Debe indicar ventaDetalleId cuando la venta tiene más de un detalle',
      );
    }

    return detalles[0];
  }

  private buildMovimientoAjustePrecio(params: {
    ajusteId: number;
    clienteId: number;
    ventaId: number;
    precioAnterior: Prisma.Decimal;
    precioNuevo: Prisma.Decimal;
    montoDiferencia: Prisma.Decimal;
    saldoAnteriorCliente: Prisma.Decimal;
  }): Prisma.MovimientoCuentaClienteUncheckedCreateInput {
    const montoAbs = params.montoDiferencia.abs();
    const reduceDeuda = params.montoDiferencia.greaterThan(0);

    return {
      clienteId: params.clienteId,
      ventaId: params.ventaId,
      ajusteVentaId: params.ajusteId,
      tipo: TipoMovimientoCuenta.AJUSTE_PRECIO,
      descripcion: `Ajuste de precio en venta #${params.ventaId}: precio corregido de S/ ${params.precioAnterior.toFixed(2)} a S/ ${params.precioNuevo.toFixed(2)}`,
      cargo: reduceDeuda ? new Prisma.Decimal(0) : montoAbs,
      abono: reduceDeuda ? montoAbs : new Prisma.Decimal(0),
      saldo: reduceDeuda
        ? params.saldoAnteriorCliente.minus(montoAbs)
        : params.saldoAnteriorCliente.plus(montoAbs),
    };
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

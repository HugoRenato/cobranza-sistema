import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoMovimientoCuenta, VentaEstado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVentaDto } from './dto/create-venta.dto';

const ventaInclude = {
  cliente: true,
  detalles: {
    include: {
      producto: true,
    },
  },
};

@Injectable()
export class VentasService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.ventaCredito.findMany({
      include: ventaInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const venta = await this.prisma.ventaCredito.findUnique({
      where: { id },
      include: ventaInclude,
    });

    if (!venta) {
      throw new NotFoundException(`Venta con id ${id} no encontrada`);
    }

    return venta;
  }

  async findByCliente(clienteId: number) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con id ${clienteId} no encontrado`);
    }

    return this.prisma.ventaCredito.findMany({
      where: { clienteId },
      include: ventaInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(createVentaDto: CreateVentaDto) {
    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findFirst({
        where: {
          id: createVentaDto.clienteId,
          activo: true,
        },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado o inactivo');
      }

      const productoIds = [
        ...new Set(createVentaDto.items.map((item) => item.productoId)),
      ];
      const productos = await tx.producto.findMany({
        where: {
          id: { in: productoIds },
          activo: true,
        },
      });
      const productosPorId = new Map(
        productos.map((producto) => [producto.id, producto]),
      );

      for (const productoId of productoIds) {
        if (!productosPorId.has(productoId)) {
          throw new NotFoundException(
            `Producto con id ${productoId} no encontrado o inactivo`,
          );
        }
      }

      const detalles = createVentaDto.items.map((item) => {
        const producto = productosPorId.get(item.productoId);

        if (!producto) {
          throw new NotFoundException(
            `Producto con id ${item.productoId} no encontrado o inactivo`,
          );
        }

        const cantidad = new Prisma.Decimal(item.cantidad);
        const precioUnitario =
          item.precioUnitario === undefined
            ? producto.precioBase
            : new Prisma.Decimal(item.precioUnitario);

        if (cantidad.lessThanOrEqualTo(0) || precioUnitario.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            'La cantidad y el precio unitario deben ser mayores a 0',
          );
        }

        return {
          productoId: item.productoId,
          cantidad,
          precioUnitario,
          subtotal: cantidad.mul(precioUnitario),
        };
      });

      const total = detalles.reduce(
        (suma, detalle) => suma.plus(detalle.subtotal),
        new Prisma.Decimal(0),
      );

      if (total.lessThanOrEqualTo(0)) {
        throw new BadRequestException('El total de la venta debe ser mayor a 0');
      }

      const stockRequeridoPorProducto = detalles.reduce(
        (stockMap, detalle) => {
          const stockActual =
            stockMap.get(detalle.productoId) ?? new Prisma.Decimal(0);
          stockMap.set(detalle.productoId, stockActual.plus(detalle.cantidad));
          return stockMap;
        },
        new Map<number, Prisma.Decimal>(),
      );

      for (const [productoId, cantidadRequerida] of stockRequeridoPorProducto) {
        const producto = productosPorId.get(productoId);

        if (!producto) {
          throw new NotFoundException(
            `Producto con id ${productoId} no encontrado o inactivo`,
          );
        }

        if (
          producto.stock !== null &&
          producto.stock.lessThan(cantidadRequerida)
        ) {
          throw new ConflictException(
            `Stock insuficiente para el producto ${producto.nombre}`,
          );
        }
      }

      const fechaCompromisoPago = this.parseFechaCompromisoPago(
        createVentaDto.fechaCompromisoPago,
      );
      const ultimoMovimiento = await tx.movimientoCuentaCliente.findFirst({
        where: { clienteId: createVentaDto.clienteId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const saldoAnterior =
        ultimoMovimiento?.saldo ?? new Prisma.Decimal(0);
      const saldoActualizado = saldoAnterior.plus(total);

      const venta = await tx.ventaCredito.create({
        data: {
          clienteId: createVentaDto.clienteId,
          fechaCompromisoPago,
          total,
          saldoPendiente: total,
          estado: VentaEstado.PENDIENTE,
          observacion: createVentaDto.observacion,
          detalles: {
            create: detalles.map((detalle) => ({
              productoId: detalle.productoId,
              cantidad: detalle.cantidad,
              precioUnitario: detalle.precioUnitario,
              subtotal: detalle.subtotal,
            })),
          },
        },
      });

      for (const [productoId, cantidadRequerida] of stockRequeridoPorProducto) {
        const producto = productosPorId.get(productoId);

        if (producto && producto.stock !== null) {
          await tx.producto.update({
            where: { id: productoId },
            data: {
              stock: {
                decrement: cantidadRequerida,
              },
            },
          });
        }
      }

      await tx.movimientoCuentaCliente.create({
        data: {
          clienteId: createVentaDto.clienteId,
          ventaId: venta.id,
          tipo: TipoMovimientoCuenta.VENTA,
          descripcion: `Venta a crédito #${venta.id}`,
          cargo: total,
          abono: new Prisma.Decimal(0),
          saldo: saldoActualizado,
        },
      });

      return tx.ventaCredito.findUnique({
        where: { id: venta.id },
        include: ventaInclude,
      });
    });
  }

  private parseFechaCompromisoPago(fecha?: string) {
    if (!fecha) {
      return undefined;
    }

    const parsedDate = new Date(fecha);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('fechaCompromisoPago no es válida');
    }

    return parsedDate;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MensajeWhatsAppEstado,
  MensajeWhatsAppTipo,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const mensajeInclude = {
  cliente: true,
  venta: true,
  pago: true,
};

@Injectable()
export class WhatsappService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.mensajeWhatsApp.findMany({
      include: mensajeInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const mensaje = await this.prisma.mensajeWhatsApp.findUnique({
      where: { id },
      include: mensajeInclude,
    });

    if (!mensaje) {
      throw new NotFoundException(
        `Mensaje de WhatsApp con id ${id} no encontrado`,
      );
    }

    return mensaje;
  }

  findByCliente(clienteId: number) {
    return this.prisma.mensajeWhatsApp.findMany({
      where: { clienteId },
      include: mensajeInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async marcarEnviado(id: number) {
    await this.findOne(id);

    return this.prisma.mensajeWhatsApp.update({
      where: { id },
      data: {
        estado: MensajeWhatsAppEstado.ENVIADO,
        enviadoAt: new Date(),
        error: null,
      },
      include: mensajeInclude,
    });
  }

  async marcarFallido(id: number, error?: string) {
    await this.findOne(id);

    return this.prisma.mensajeWhatsApp.update({
      where: { id },
      data: {
        estado: MensajeWhatsAppEstado.FALLIDO,
        error: error || null,
      },
      include: mensajeInclude,
    });
  }

  async crearMensajeVentaCredito(ventaId: number) {
    const venta = await this.prisma.ventaCredito.findUnique({
      where: { id: ventaId },
      include: { cliente: true },
    });

    if (!venta || !venta.cliente.telefono) {
      return null;
    }

    return this.prisma.mensajeWhatsApp.create({
      data: {
        clienteId: venta.clienteId,
        ventaId: venta.id,
        tipo: MensajeWhatsAppTipo.VENTA_CREDITO,
        telefonoDestino: venta.cliente.telefono,
        mensaje: [
          `Hola ${venta.cliente.nombre}, se registro una venta a credito.`,
          `Total: ${this.formatMoney(venta.total)}.`,
          `Saldo pendiente: ${this.formatMoney(venta.saldoPendiente)}.`,
          venta.fechaCompromisoPago
            ? `Fecha de compromiso de pago: ${this.formatDate(venta.fechaCompromisoPago)}.`
            : undefined,
        ]
          .filter(Boolean)
          .join(' '),
      },
      include: mensajeInclude,
    });
  }

  async crearMensajeAbono(pagoId: number) {
    const pago = await this.prisma.pagoAbono.findUnique({
      where: { id: pagoId },
      include: { cliente: true },
    });

    if (!pago || !pago.cliente.telefono) {
      return null;
    }

    const saldoActual = await this.getSaldoActualCliente(pago.clienteId);

    return this.prisma.mensajeWhatsApp.create({
      data: {
        clienteId: pago.clienteId,
        pagoId: pago.id,
        tipo: MensajeWhatsAppTipo.ABONO,
        telefonoDestino: pago.cliente.telefono,
        mensaje: [
          `Hola ${pago.cliente.nombre}, se registro un abono.`,
          `Monto abonado: ${this.formatMoney(pago.monto)}.`,
          `Medio de pago: ${pago.medioPago}.`,
          `Saldo actual: ${this.formatMoney(saldoActual)}.`,
        ].join(' '),
      },
      include: mensajeInclude,
    });
  }

  async crearMensajeAnulacionPago(pagoId: number) {
    const pago = await this.prisma.pagoAbono.findUnique({
      where: { id: pagoId },
      include: { cliente: true },
    });

    if (!pago || !pago.cliente.telefono) {
      return null;
    }

    const saldoActual = await this.getSaldoActualCliente(pago.clienteId);

    return this.prisma.mensajeWhatsApp.create({
      data: {
        clienteId: pago.clienteId,
        pagoId: pago.id,
        tipo: MensajeWhatsAppTipo.ANULACION,
        telefonoDestino: pago.cliente.telefono,
        mensaje: [
          `Hola ${pago.cliente.nombre}, el abono #${pago.id} fue anulado.`,
          `Saldo actual: ${this.formatMoney(saldoActual)}.`,
        ].join(' '),
      },
      include: mensajeInclude,
    });
  }

  async crearMensajeAnulacionVenta(ventaId: number) {
    const venta = await this.prisma.ventaCredito.findUnique({
      where: { id: ventaId },
      include: { cliente: true },
    });

    if (!venta || !venta.cliente.telefono) {
      return null;
    }

    const saldoActual = await this.getSaldoActualCliente(venta.clienteId);

    return this.prisma.mensajeWhatsApp.create({
      data: {
        clienteId: venta.clienteId,
        ventaId: venta.id,
        tipo: MensajeWhatsAppTipo.ANULACION,
        telefonoDestino: venta.cliente.telefono,
        mensaje: [
          `Hola ${venta.cliente.nombre}, la venta a credito #${venta.id} fue anulada.`,
          `Saldo actual: ${this.formatMoney(saldoActual)}.`,
        ].join(' '),
      },
      include: mensajeInclude,
    });
  }

  private async getSaldoActualCliente(clienteId: number) {
    const ultimoMovimiento =
      await this.prisma.movimientoCuentaCliente.findFirst({
        where: { clienteId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });

    return ultimoMovimiento?.saldo ?? new Prisma.Decimal(0);
  }

  private formatMoney(value: Prisma.Decimal) {
    return value.toNumber().toFixed(2);
  }

  private formatDate(value: Date) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}

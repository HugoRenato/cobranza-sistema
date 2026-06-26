import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoMovimientoCuenta } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

type KardexFiltros = {
  fechaDesde?: string;
  fechaHasta?: string;
};

type ParsedFechas = {
  fechaDesde?: Date;
  fechaHasta?: Date;
};

type KardexMovimiento = {
  numero: string;
  fecha: string;
  movimiento: string;
  descripcion: string;
  referencia: string;
  cargo: string;
  abono: string;
  saldo: string;
};

const pageMargin = 40;
const tableColumns = [
  { key: 'numero', label: 'N°', width: 24, align: 'center' },
  { key: 'fecha', label: 'Fecha', width: 52, align: 'left' },
  { key: 'movimiento', label: 'Movimiento', width: 74, align: 'left' },
  { key: 'descripcion', label: 'Descripción', width: 110, align: 'left' },
  { key: 'referencia', label: 'Referencia / Medio', width: 70, align: 'left' },
  { key: 'cargo', label: 'Cargo / Compra', width: 62, align: 'right' },
  { key: 'abono', label: 'Abono / Pago', width: 62, align: 'right' },
  { key: 'saldo', label: 'Saldo', width: 61, align: 'right' },
] as const;

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async generarKardexCobranzaClientePdf(
    clienteId: number,
    filtros: KardexFiltros,
  ) {
    const fechas = this.parseFechas(filtros);

    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con id ${clienteId} no encontrado`);
    }

    const movimientosWhere: Prisma.MovimientoCuentaClienteWhereInput = {
      clienteId,
      ...(fechas.fechaDesde || fechas.fechaHasta
        ? {
            createdAt: {
              ...(fechas.fechaDesde ? { gte: fechas.fechaDesde } : {}),
              ...(fechas.fechaHasta ? { lte: fechas.fechaHasta } : {}),
            },
          }
        : {}),
    };

    const [movimientos, movimientoAnterior] = await Promise.all([
      this.prisma.movimientoCuentaCliente.findMany({
        where: movimientosWhere,
        include: { pago: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      fechas.fechaDesde
        ? this.prisma.movimientoCuentaCliente.findFirst({
            where: {
              clienteId,
              createdAt: { lt: fechas.fechaDesde },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          })
        : null,
    ]);

    const saldoInicial = fechas.fechaDesde
      ? this.toNumber(movimientoAnterior?.saldo)
      : 0;
    const comprasPeriodo = movimientos.reduce(
      (total, movimiento) => total + this.toNumber(movimiento.cargo),
      0,
    );
    const abonosPeriodo = movimientos.reduce(
      (total, movimiento) => total + this.toNumber(movimiento.abono),
      0,
    );
    const anulacionesPeriodo = movimientos
      .filter(
        (movimiento) => movimiento.tipo === TipoMovimientoCuenta.ANULACION,
      )
      .reduce(
        (total, movimiento) =>
          total +
          this.toNumber(movimiento.cargo) +
          this.toNumber(movimiento.abono),
        0,
      );
    const saldoFinal = movimientos.length
      ? this.toNumber(movimientos[movimientos.length - 1].saldo)
      : saldoInicial;

    const filas: KardexMovimiento[] = movimientos.map((movimiento, index) => ({
      numero: `${index + 1}`,
      fecha: this.formatDate(movimiento.createdAt),
      movimiento: this.formatMovimiento(movimiento.tipo),
      descripcion: movimiento.descripcion,
      referencia: movimiento.pago
        ? [
            movimiento.pago.medioPago,
            movimiento.pago.referencia
              ? `Ref. ${movimiento.pago.referencia}`
              : '',
          ]
            .filter(Boolean)
            .join(' - ')
        : '-',
      cargo: this.formatCurrency(movimiento.cargo),
      abono: this.formatCurrency(movimiento.abono),
      saldo: this.formatCurrency(movimiento.saldo),
    }));

    if (fechas.fechaDesde) {
      filas.unshift({
        numero: '0',
        fecha: this.formatDate(fechas.fechaDesde),
        movimiento: 'SALDO INICIAL',
        descripcion: 'Saldo antes del periodo consultado',
        referencia: '-',
        cargo: this.formatCurrency(0),
        abono: this.formatCurrency(0),
        saldo: this.formatCurrency(saldoInicial),
      });
    }

    return this.buildPdf({
      cliente,
      filas,
      fechas,
      resumen: {
        saldoInicial,
        comprasPeriodo,
        abonosPeriodo,
        anulacionesPeriodo,
        saldoFinal,
      },
    });
  }

  private buildPdf(data: {
    cliente: {
      id: number;
      nombre: string;
      documento: string | null;
      telefono: string | null;
      direccion: string | null;
    };
    filas: KardexMovimiento[];
    fechas: ParsedFechas;
    resumen: {
      saldoInicial: number;
      comprasPeriodo: number;
      abonosPeriodo: number;
      anulacionesPeriodo: number;
      saldoFinal: number;
    };
  }) {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: pageMargin,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.drawHeader(doc, data.fechas);
      this.drawClienteCard(doc, data.cliente);
      this.drawResumen(doc, data.resumen);
      this.drawKardexTable(doc, data.filas);
      this.drawNotas(doc);

      doc.end();
    });
  }

  private drawHeader(doc: PDFKit.PDFDocument, fechas: ParsedFechas) {
    doc
      .font('Helvetica-Bold')
      .fontSize(17)
      .fillColor('#111827')
      .text('KARDEX DE COBRANZA DEL CLIENTE', pageMargin, 36, {
        align: 'center',
      });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#4b5563')
      .text('Estado de cuenta y movimientos de cobranza', {
        align: 'center',
      });

    doc.moveDown(1.1);
    const emissionY = doc.y;
    doc
      .fontSize(9)
      .fillColor('#374151')
      .text(
        `Fecha de emisión: ${this.formatDate(new Date())}`,
        pageMargin,
        emissionY,
      );
    doc.text(`Periodo: ${this.formatPeriodo(fechas)}`, pageMargin, doc.y + 3);
    this.drawLine(doc, doc.y + 10);
    doc.y += 22;
  }

  private drawClienteCard(
    doc: PDFKit.PDFDocument,
    cliente: {
      nombre: string;
      documento: string | null;
      telefono: string | null;
      direccion: string | null;
    },
  ) {
    const y = doc.y;
    const height = 78;

    doc
      .roundedRect(pageMargin, y, this.contentWidth(doc), height, 6)
      .fill('#f9fafb');
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#111827')
      .text('Datos del cliente', pageMargin + 12, y + 10);

    const left = pageMargin + 12;
    const right = pageMargin + 285;
    doc.font('Helvetica').fontSize(9).fillColor('#374151');
    doc.text(`Cliente: ${cliente.nombre}`, left, y + 30, { width: 250 });
    doc.text(`Documento: ${cliente.documento ?? '-'}`, left, y + 48, {
      width: 250,
    });
    doc.text(`Teléfono: ${cliente.telefono ?? '-'}`, right, y + 30, {
      width: 210,
    });
    doc.text(`Dirección: ${cliente.direccion ?? '-'}`, right, y + 48, {
      width: 210,
    });
    doc.y = y + height + 18;
  }

  private drawResumen(
    doc: PDFKit.PDFDocument,
    resumen: {
      saldoInicial: number;
      comprasPeriodo: number;
      abonosPeriodo: number;
      anulacionesPeriodo: number;
      saldoFinal: number;
    },
  ) {
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#111827')
      .text('Resumen financiero', pageMargin, doc.y);
    doc.y += 8;

    const items = [
      ['Saldo inicial del periodo', resumen.saldoInicial],
      ['Compras a crédito del periodo', resumen.comprasPeriodo],
      ['Abonos del periodo', resumen.abonosPeriodo],
      ['Anulaciones del periodo', resumen.anulacionesPeriodo],
      ['Saldo final pendiente', resumen.saldoFinal],
    ];
    const colWidth = this.contentWidth(doc) / items.length;
    const y = doc.y;

    items.forEach(([label, value], index) => {
      const x = pageMargin + colWidth * index;
      doc.rect(x, y, colWidth, 52).strokeColor('#e5e7eb').stroke();
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#6b7280')
        .text(String(label), x + 6, y + 8, { width: colWidth - 12 });
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#111827')
        .text(this.formatCurrency(Number(value)), x + 6, y + 29, {
          width: colWidth - 12,
          align: 'right',
        });
    });

    doc.y = y + 70;
  }

  private drawKardexTable(doc: PDFKit.PDFDocument, filas: KardexMovimiento[]) {
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#111827')
      .text('Tabla Kardex de cobranza', pageMargin, doc.y);
    doc.y += 8;

    this.drawTableHeader(doc);

    if (filas.length === 0) {
      this.drawTableRow(doc, {
        numero: '-',
        fecha: '-',
        movimiento: '-',
        descripcion: 'Este cliente aún no tiene movimientos registrados.',
        referencia: '-',
        cargo: this.formatCurrency(0),
        abono: this.formatCurrency(0),
        saldo: this.formatCurrency(0),
      });
      return;
    }

    filas.forEach((fila) => this.drawTableRow(doc, fila));
  }

  private drawTableHeader(doc: PDFKit.PDFDocument) {
    const y = doc.y;
    let x = pageMargin;

    doc.rect(pageMargin, y, this.contentWidth(doc), 24).fill('#e5e7eb');
    doc.font('Helvetica-Bold').fontSize(7.4).fillColor('#111827');

    tableColumns.forEach((column) => {
      doc.text(column.label, x + 3, y + 7, {
        width: column.width - 6,
        align: column.align,
      });
      x += column.width;
    });

    doc.y = y + 24;
  }

  private drawTableRow(doc: PDFKit.PDFDocument, row: KardexMovimiento) {
    const minHeight = 28;
    const rowHeight = Math.max(
      minHeight,
      doc.heightOfString(row.descripcion, { width: 104, align: 'left' }) + 14,
      doc.heightOfString(row.referencia, { width: 64, align: 'left' }) + 14,
    );

    if (doc.y + rowHeight > doc.page.height - 78) {
      doc.addPage();
      this.drawTableHeader(doc);
    }

    const y = doc.y;
    let x = pageMargin;

    doc
      .rect(pageMargin, y, this.contentWidth(doc), rowHeight)
      .strokeColor('#e5e7eb')
      .stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor('#111827');

    tableColumns.forEach((column) => {
      const value = row[column.key];
      doc.text(value, x + 3, y + 7, {
        width: column.width - 6,
        align: column.align,
      });
      x += column.width;
    });

    doc.y = y + rowHeight;
  }

  private drawNotas(doc: PDFKit.PDFDocument) {
    if (doc.y > doc.page.height - 140) {
      doc.addPage();
    }

    doc.y += 18;
    this.drawLine(doc, doc.y);
    doc.y += 12;
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#4b5563')
      .text(
        'El saldo final pendiente corresponde al resultado de las compras a crédito menos los abonos y movimientos registrados hasta la fecha de emisión del presente reporte.',
        pageMargin,
        doc.y,
        { width: this.contentWidth(doc), align: 'justify' },
      );
    doc.y += 8;
    doc.text(
      'Si usted realizó un pago adicional, este será reflejado en el siguiente estado de cuenta una vez registrado en el sistema.',
      pageMargin,
      doc.y,
      { width: this.contentWidth(doc), align: 'justify' },
    );
  }

  private parseFechas(filtros: KardexFiltros): ParsedFechas {
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
        throw new BadRequestException(`${campo} no es válida`);
      }

      return parsedDate;
    }

    const parsedDate = new Date(fecha);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(`${campo} no es válida`);
    }

    return parsedDate;
  }

  private formatPeriodo(fechas: ParsedFechas) {
    if (fechas.fechaDesde && fechas.fechaHasta) {
      return `${this.formatDate(fechas.fechaDesde)} al ${this.formatDate(fechas.fechaHasta)}`;
    }

    if (fechas.fechaDesde) {
      return `Desde ${this.formatDate(fechas.fechaDesde)}`;
    }

    if (fechas.fechaHasta) {
      return `Hasta ${this.formatDate(fechas.fechaHasta)}`;
    }

    return 'Todos los movimientos';
  }

  private formatMovimiento(tipo: TipoMovimientoCuenta) {
    const labels: Record<TipoMovimientoCuenta, string> = {
      VENTA: 'Venta a crédito',
      ABONO: 'Abono registrado',
      ANULACION: 'Anulación / reversa',
      AJUSTE: 'Ajuste de cuenta',
      AJUSTE_PRECIO: 'Ajuste de precio',
      COMPENSACION_ABONO: 'Compensación a favor',
      COMPENSACION_CARGO: 'Deuda asumida por compensación',
    };

    return labels[tipo];
  }

  private formatCurrency(value: Prisma.Decimal | number | null | undefined) {
    const amount = this.toNumber(value);

    return `S/ ${amount.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value === null || value === undefined) {
      return 0;
    }

    return typeof value === 'number' ? value : value.toNumber();
  }

  private drawLine(doc: PDFKit.PDFDocument, y: number) {
    doc
      .moveTo(pageMargin, y)
      .lineTo(doc.page.width - pageMargin, y)
      .strokeColor('#d1d5db')
      .stroke();
  }

  private contentWidth(doc: PDFKit.PDFDocument) {
    return doc.page.width - pageMargin * 2;
  }
}

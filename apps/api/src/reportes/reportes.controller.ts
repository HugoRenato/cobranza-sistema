import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import type { Request } from 'express';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { ReportesService } from './reportes.service';

@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly reportesService: ReportesService,
    private readonly auditService: AuditService,
  ) {}

  @Get('clientes/:clienteId/kardex-cobranza/pdf')
  async getKardexCobranzaClientePdf(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Query('fechaDesde') fechaDesde: string | undefined,
    @Query('fechaHasta') fechaHasta: string | undefined,
    @Req() request: Request,
    @Res() res: Response,
  ) {
    const pdf = await this.reportesService.generarKardexCobranzaClientePdf(
      clienteId,
      { fechaDesde, fechaHasta },
    );
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.DOWNLOAD,
        module: 'reportes',
        entity: 'Cliente',
        entityId: clienteId,
        description: `Descarga de Kardex PDF del cliente #${clienteId}`,
        afterData: { clienteId, fechaDesde, fechaHasta },
      },
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="kardex-cobranza-cliente-${clienteId}.pdf"`,
    );
    res.send(pdf);
  }
}

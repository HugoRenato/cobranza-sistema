import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { PagosService } from './pagos.service';

@Controller('pagos')
export class PagosController {
  constructor(
    private readonly pagosService: PagosService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll() {
    return this.pagosService.findAll();
  }

  @Get('cliente/:clienteId')
  findByCliente(@Param('clienteId', ParseIntPipe) clienteId: number) {
    return this.pagosService.findByCliente(clienteId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pagosService.findOne(id);
  }

  @Patch(':id/anular')
  async anular(@Param('id', ParseIntPipe) id: number, @Req() request: Request) {
    const before = await this.pagosService.findOne(id);
    const pago = await this.pagosService.anular(id);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.ANULAR,
        module: 'pagos',
        entity: 'PagoAbono',
        entityId: id,
        description: `Pago anulado #${id}`,
        beforeData: before,
        afterData: pago,
      },
    );

    return pago;
  }

  @Post()
  async create(@Body() createPagoDto: CreatePagoDto, @Req() request: Request) {
    const pago = await this.pagosService.create(createPagoDto);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.CREATE,
        module: 'pagos',
        entity: 'PagoAbono',
        entityId: pago?.id,
        description: `Pago creado #${pago?.id}`,
        afterData: pago,
      },
    );

    return pago;
  }
}

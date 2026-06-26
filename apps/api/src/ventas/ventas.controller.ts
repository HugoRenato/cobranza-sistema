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
import { CreateVentaDto } from './dto/create-venta.dto';
import { VentasService } from './ventas.service';

@Controller('ventas')
export class VentasController {
  constructor(
    private readonly ventasService: VentasService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll() {
    return this.ventasService.findAll();
  }

  @Get('cliente/:clienteId')
  findByCliente(@Param('clienteId', ParseIntPipe) clienteId: number) {
    return this.ventasService.findByCliente(clienteId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ventasService.findOne(id);
  }

  @Patch(':id/anular')
  async anular(@Param('id', ParseIntPipe) id: number, @Req() request: Request) {
    const before = await this.ventasService.findOne(id);
    const venta = await this.ventasService.anular(id);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.ANULAR,
        module: 'ventas',
        entity: 'VentaCredito',
        entityId: id,
        description: `Venta anulada #${id}`,
        beforeData: before,
        afterData: venta,
      },
    );

    return venta;
  }

  @Post()
  async create(
    @Body() createVentaDto: CreateVentaDto,
    @Req() request: Request,
  ) {
    const venta = await this.ventasService.create(createVentaDto);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.CREATE,
        module: 'ventas',
        entity: 'VentaCredito',
        entityId: venta?.id,
        description: `Venta creada #${venta?.id}`,
        afterData: venta,
      },
    );

    return venta;
  }
}

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
import { AjustesVentaService } from './ajustes-venta.service';
import { CreateAjustePrecioDto } from './dto/create-ajuste-precio.dto';

@Controller('ajustes-venta')
export class AjustesVentaController {
  constructor(
    private readonly ajustesVentaService: AjustesVentaService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll() {
    return this.ajustesVentaService.findAll();
  }

  @Get('venta/:ventaId')
  findByVenta(@Param('ventaId', ParseIntPipe) ventaId: number) {
    return this.ajustesVentaService.findByVenta(ventaId);
  }

  @Get('cliente/:clienteId')
  findByCliente(@Param('clienteId', ParseIntPipe) clienteId: number) {
    return this.ajustesVentaService.findByCliente(clienteId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ajustesVentaService.findOne(id);
  }

  @Post('precio')
  async ajustarPrecio(
    @Body() createAjustePrecioDto: CreateAjustePrecioDto,
    @Req() request: Request,
  ) {
    const ajuste = await this.ajustesVentaService.ajustarPrecio(
      createAjustePrecioDto,
    );
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.AJUSTE,
        module: 'ajustes-venta',
        entity: 'AjusteVenta',
        entityId: ajuste?.id,
        description: `Ajuste de precio creado #${ajuste?.id}`,
        afterData: ajuste,
      },
    );

    return ajuste;
  }

  @Patch(':id/anular')
  async anular(@Param('id', ParseIntPipe) id: number, @Req() request: Request) {
    const before = await this.ajustesVentaService.findOne(id);
    const ajuste = await this.ajustesVentaService.anular(id);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.ANULAR,
        module: 'ajustes-venta',
        entity: 'AjusteVenta',
        entityId: id,
        description: `Ajuste de precio anulado #${id}`,
        beforeData: before,
        afterData: ajuste,
      },
    );

    return ajuste;
  }
}

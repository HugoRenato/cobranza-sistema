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
import { CompensacionesService } from './compensaciones.service';
import { CreateCompensacionDto } from './dto/create-compensacion.dto';

@Controller('compensaciones')
export class CompensacionesController {
  constructor(
    private readonly compensacionesService: CompensacionesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll() {
    return this.compensacionesService.findAll();
  }

  @Get('cliente/:clienteId')
  findByCliente(@Param('clienteId', ParseIntPipe) clienteId: number) {
    return this.compensacionesService.findByCliente(clienteId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.compensacionesService.findOne(id);
  }

  @Post()
  async create(
    @Body() createCompensacionDto: CreateCompensacionDto,
    @Req() request: Request,
  ) {
    const compensacion = await this.compensacionesService.create(
      createCompensacionDto,
    );
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.COMPENSACION,
        module: 'compensaciones',
        entity: 'CompensacionCuenta',
        entityId: compensacion?.id,
        description: `Compensación creada #${compensacion?.id}`,
        afterData: compensacion,
      },
    );

    return compensacion;
  }

  @Patch(':id/anular')
  async anular(@Param('id', ParseIntPipe) id: number, @Req() request: Request) {
    const before = await this.compensacionesService.findOne(id);
    const compensacion = await this.compensacionesService.anular(id);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.ANULAR,
        module: 'compensaciones',
        entity: 'CompensacionCuenta',
        entityId: id,
        description: `Compensación anulada #${id}`,
        beforeData: before,
        afterData: compensacion,
      },
    );

    return compensacion;
  }
}

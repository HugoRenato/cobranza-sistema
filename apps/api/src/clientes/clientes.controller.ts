import {
  Body,
  Controller,
  Delete,
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
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Controller('clientes')
export class ClientesController {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll() {
    return this.clientesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.findOne(id);
  }

  @Post()
  async create(
    @Body() createClienteDto: CreateClienteDto,
    @Req() request: Request,
  ) {
    const cliente = await this.clientesService.create(createClienteDto);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.CREATE,
        module: 'clientes',
        entity: 'Cliente',
        entityId: cliente.id,
        description: `Cliente creado: ${cliente.nombre}`,
        afterData: cliente,
      },
    );

    return cliente;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClienteDto: UpdateClienteDto,
    @Req() request: Request,
  ) {
    const before = await this.clientesService.findOne(id);
    const cliente = await this.clientesService.update(id, updateClienteDto);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.UPDATE,
        module: 'clientes',
        entity: 'Cliente',
        entityId: id,
        description: `Cliente actualizado: ${cliente.nombre}`,
        beforeData: before,
        afterData: cliente,
      },
    );

    return cliente;
  }

  @Delete(':id')
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
  ) {
    const before = await this.clientesService.findOne(id);
    const cliente = await this.clientesService.deactivate(id);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.DELETE,
        module: 'clientes',
        entity: 'Cliente',
        entityId: id,
        description: `Cliente desactivado: ${cliente.nombre}`,
        beforeData: before,
        afterData: cliente,
      },
    );

    return cliente;
  }
}

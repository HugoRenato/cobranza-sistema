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
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { ProductosService } from './productos.service';

@Controller('productos')
export class ProductosController {
  constructor(
    private readonly productosService: ProductosService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll() {
    return this.productosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.findOne(id);
  }

  @Post()
  async create(
    @Body() createProductoDto: CreateProductoDto,
    @Req() request: Request,
  ) {
    const producto = await this.productosService.create(createProductoDto);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.CREATE,
        module: 'productos',
        entity: 'Producto',
        entityId: producto?.id,
        description: `Producto creado: ${producto?.nombre}`,
        afterData: producto,
      },
    );

    return producto;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductoDto: UpdateProductoDto,
    @Req() request: Request,
  ) {
    const before = await this.productosService.findOne(id);
    const producto = await this.productosService.update(id, updateProductoDto);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.UPDATE,
        module: 'productos',
        entity: 'Producto',
        entityId: id,
        description: `Producto actualizado: ${producto?.nombre}`,
        beforeData: before,
        afterData: producto,
      },
    );

    return producto;
  }

  @Delete(':id')
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
  ) {
    const before = await this.productosService.findOne(id);
    const producto = await this.productosService.deactivate(id);
    await this.auditService.logWithContext(
      this.auditService.contextFromRequest(request),
      {
        action: AuditAction.DELETE,
        module: 'productos',
        entity: 'Producto',
        entityId: id,
        description: `Producto desactivado: ${producto.nombre}`,
        beforeData: before,
        afterData: producto,
      },
    );

    return producto;
  }
}

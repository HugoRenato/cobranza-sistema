import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateVentaDto } from './dto/create-venta.dto';
import { VentasService } from './ventas.service';

@Controller('ventas')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

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

  @Post()
  create(@Body() createVentaDto: CreateVentaDto) {
    return this.ventasService.create(createVentaDto);
  }
}

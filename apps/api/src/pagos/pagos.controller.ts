import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreatePagoDto } from './dto/create-pago.dto';
import { PagosService } from './pagos.service';

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

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

  @Post()
  create(@Body() createPagoDto: CreatePagoDto) {
    return this.pagosService.create(createPagoDto);
  }
}

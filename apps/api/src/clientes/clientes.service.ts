import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createClienteDto: CreateClienteDto) {
    return this.prisma.cliente.create({
      data: {
        ...createClienteDto,
        activo: createClienteDto.activo ?? true,
      },
    });
  }

  findAll() {
    return this.prisma.cliente.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con id ${id} no encontrado`);
    }

    return cliente;
  }

  async update(id: number, updateClienteDto: UpdateClienteDto) {
    await this.findOne(id);

    return this.prisma.cliente.update({
      where: { id },
      data: updateClienteDto,
    });
  }

  async deactivate(id: number) {
    await this.findOne(id);

    return this.prisma.cliente.update({
      where: { id },
      data: { activo: false },
    });
  }
}

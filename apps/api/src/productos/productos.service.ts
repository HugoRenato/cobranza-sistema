import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProductoDto: CreateProductoDto) {
    try {
      return await this.prisma.producto.create({
        data: {
          ...createProductoDto,
          activo: createProductoDto.activo ?? true,
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  findAll() {
    return this.prisma.producto.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
    });

    if (!producto) {
      throw new NotFoundException(`Producto con id ${id} no encontrado`);
    }

    return producto;
  }

  async update(id: number, updateProductoDto: UpdateProductoDto) {
    await this.findOne(id);

    try {
      return await this.prisma.producto.update({
        where: { id },
        data: updateProductoDto,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async deactivate(id: number) {
    await this.findOne(id);

    return this.prisma.producto.update({
      where: { id },
      data: { activo: false },
    });
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Ya existe un producto con ese código');
    }

    throw error;
  }
}

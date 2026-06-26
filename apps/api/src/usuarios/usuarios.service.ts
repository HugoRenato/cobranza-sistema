import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, UsuarioEstado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertStrongPassword } from '../common/security/password-strength';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

const usuarioSelect = {
  id: true,
  nombre: true,
  email: true,
  estado: true,
  ultimoLogin: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UsuarioSelect;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.usuario.findMany({
      select: usuarioSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: usuarioSelect,
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }

    return usuario;
  }

  async create(createUsuarioDto: CreateUsuarioDto) {
    assertStrongPassword(createUsuarioDto.password);

    const email = createUsuarioDto.email.toLowerCase().trim();
    const existe = await this.prisma.usuario.findUnique({ where: { email } });

    if (existe) {
      throw new ConflictException('Ya existe un usuario con ese email');
    }

    const password = await bcrypt.hash(createUsuarioDto.password, 10);

    return this.prisma.usuario.create({
      data: {
        nombre: createUsuarioDto.nombre.trim(),
        email,
        password,
      },
      select: usuarioSelect,
    });
  }

  async update(id: number, updateUsuarioDto: UpdateUsuarioDto) {
    await this.findOne(id);

    const data: Prisma.UsuarioUpdateInput = {};

    if (updateUsuarioDto.nombre !== undefined) {
      data.nombre = updateUsuarioDto.nombre.trim();
    }

    if (updateUsuarioDto.email !== undefined) {
      const email = updateUsuarioDto.email.toLowerCase().trim();
      const existe = await this.prisma.usuario.findFirst({
        where: {
          email,
          id: { not: id },
        },
      });

      if (existe) {
        throw new ConflictException('Ya existe un usuario con ese email');
      }

      data.email = email;
    }

    if (updateUsuarioDto.password !== undefined) {
      assertStrongPassword(updateUsuarioDto.password);
      data.password = await bcrypt.hash(updateUsuarioDto.password, 10);
    }

    if (updateUsuarioDto.estado !== undefined) {
      data.estado = updateUsuarioDto.estado;
    }

    return this.prisma.usuario.update({
      where: { id },
      data,
      select: usuarioSelect,
    });
  }

  desactivar(id: number) {
    return this.cambiarEstado(id, UsuarioEstado.INACTIVO);
  }

  activar(id: number) {
    return this.cambiarEstado(id, UsuarioEstado.ACTIVO);
  }

  private async cambiarEstado(id: number, estado: UsuarioEstado) {
    await this.findOne(id);

    return this.prisma.usuario.update({
      where: { id },
      data: { estado },
      select: usuarioSelect,
    });
  }
}

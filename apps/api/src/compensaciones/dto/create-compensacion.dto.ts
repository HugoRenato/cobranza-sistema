import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { UnidadNegocio } from '@prisma/client';

export class CreateCompensacionDto {
  @Type(() => Number)
  @IsNumber()
  clienteOrigenId: number;

  @Type(() => Number)
  @IsNumber()
  cuentaDestinoId: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monto: number;

  @IsOptional()
  @IsEnum(UnidadNegocio)
  unidadNegocio?: UnidadNegocio;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsString()
  @MinLength(1)
  motivo: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}

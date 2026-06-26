import { MedioPago } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreatePagoDto {
  @Type(() => Number)
  @IsNumber()
  clienteId: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monto: number;

  @IsEnum(MedioPago)
  medioPago: MedioPago;

  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}

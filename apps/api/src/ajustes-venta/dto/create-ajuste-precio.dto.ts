import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateAjustePrecioDto {
  @Type(() => Number)
  @IsNumber()
  ventaId: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  ventaDetalleId?: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  precioNuevo: number;

  @IsString()
  @MinLength(1)
  motivo: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}

import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateProductoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  unidad?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  precioBase?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  stock?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateVentaDetalleDto } from './create-venta-detalle.dto';

export class CreateVentaDto {
  @IsNumber()
  clienteId: number;

  @IsOptional()
  @IsDateString()
  fechaCompromisoPago?: string;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateVentaDetalleDto)
  items: CreateVentaDetalleDto[];
}

import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class CreateVentaDetalleDto {
  @IsNumber()
  productoId: number;

  @IsNumber()
  @IsPositive()
  cantidad: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  precioUnitario?: number;
}

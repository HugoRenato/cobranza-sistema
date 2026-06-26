import { BadRequestException } from '@nestjs/common';

const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function assertStrongPassword(password: string) {
  if (!strongPasswordRegex.test(password)) {
    throw new BadRequestException(
      'La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y símbolo',
    );
  }
}

import { PrismaClient, UsuarioEstado } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@cobranza.com';
  const existe = await prisma.usuario.findUnique({ where: { email } });

  if (existe) {
    console.log('Usuario inicial ya existe:', email);
    return;
  }

  const password = await bcrypt.hash('Admin123*', 10);

  await prisma.usuario.create({
    data: {
      nombre: 'Administrador',
      email,
      password,
      estado: UsuarioEstado.ACTIVO,
    },
  });

  console.log('Usuario inicial creado:', email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

-- CreateTable
CREATE TABLE `MensajeWhatsApp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clienteId` INTEGER NOT NULL,
    `ventaId` INTEGER NULL,
    `pagoId` INTEGER NULL,
    `tipo` ENUM('VENTA_CREDITO', 'ABONO', 'ESTADO_CUENTA', 'RECORDATORIO', 'ANULACION') NOT NULL,
    `telefonoDestino` VARCHAR(191) NOT NULL,
    `mensaje` TEXT NOT NULL,
    `estado` ENUM('PENDIENTE', 'ENVIADO', 'FALLIDO', 'CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
    `error` VARCHAR(191) NULL,
    `enviadoAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MensajeWhatsApp` ADD CONSTRAINT `MensajeWhatsApp_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `Cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MensajeWhatsApp` ADD CONSTRAINT `MensajeWhatsApp_ventaId_fkey` FOREIGN KEY (`ventaId`) REFERENCES `VentaCredito`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MensajeWhatsApp` ADD CONSTRAINT `MensajeWhatsApp_pagoId_fkey` FOREIGN KEY (`pagoId`) REFERENCES `PagoAbono`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

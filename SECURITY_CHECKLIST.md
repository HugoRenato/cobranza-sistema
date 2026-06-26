# Checklist de Seguridad

- [X] Cambiar contraseña admin inicial.
- [x] Usar `JWT_SECRET` fuerte en producción.
- [ ] No subir `.env` a GitHub.
- [ ] Verificar CORS con dominio real.
- [ ] Verificar backups de MySQL.
- [ ] Probar restore de backup.
- [ ] Probar login/logout.
- [ ] Probar 401 sin token.
- [ ] Probar auditoría.
- [ ] Probar descarga de PDF protegida.
- [ ] Probar anulación de pago/venta con auditoría.
- [ ] Probar compensaciones con auditoría.
- [ ] Verificar que ningún endpoint devuelva password.
- [ ] Verificar que errores no expongan stack trace en producción.

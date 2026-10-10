# Textos legales: contenido mínimo y dónde enlazarlos

Siempre en el idioma del mercado, con fecha de "Última actualización" y un único correo de contacto que exista. Redacción sencilla; el usuario final tiene que entenderlos. Indica al usuario que los revise un abogado local.

## Política de privacidad — secciones

1. Responsable y contacto.
2. **Datos que recogemos**: tabla dato / de dónde viene / para qué — una fila por fila del inventario, incluidos logs técnicos, identificadores de publicidad y estado de compras. Lo que **no** se recoge también ayuda ("no accedemos a ubicación precisa, contactos ni fotos; no guardamos datos de tarjetas").
3. Bases legales por finalidad.
4. **Con quién compartimos**: tabla proveedor / para qué / qué recibe (login, push, anuncios, pagos, tienda, CDN/infraestructura). Qué ven los otros usuarios.
5. **Publicidad y opciones** (consentimiento por región, ATT, ID de publicidad de Android, premium sin anuncios).
6. Dónde se almacenan y **transferencias internacionales**.
7. **Retención** por tipo de dato.
8. **Derechos** de la ley aplicable y cómo ejercerlos (pantalla, web de borrado, correo, plazo). Qué se borra y qué se conserva anonimizado al eliminar la cuenta; que eso no cancela suscripciones.
9. Seguridad (cifrado, hashing, notificación de brechas).
10. Menores.
11. Cambios a la política.
12. Contacto y enlace a los términos.

## Términos y condiciones — secciones

1. Qué es el servicio; si aplica, **sin dinero real / puntos sin valor monetario**.
2. Elegibilidad (edad) y cuenta.
3. Conducta y consecuencias.
4. Funcionalidades sociales (ligas, chats) y responsabilidad entre usuarios.
5. **Suscripción**: opcional, precio y período mostrados antes de comprar, renovación automática, cancelación 24 h antes, borrar la cuenta no cancela, reembolsos según la tienda sin perjuicio de la ley del consumidor.
6. Anuncios (remitir a la política).
7. Datos de terceros y **descargo de no afiliación** / marcas.
8. Propiedad intelectual y licencia de uso; licencia sobre el contenido del usuario.
9. Disponibilidad y limitación de responsabilidad (sin limitar derechos irrenunciables del consumidor).
10. Terminación (borrado propio y suspensión).
11. **Usuarios de App Store** (si hay EULA propio): el acuerdo es con el desarrollador, no con Apple; licencia limitada a dispositivos Apple del usuario; Apple sin obligación de soporte; garantía y reembolso del precio vía Apple; Apple no responde por reclamos (producto, legales, propiedad intelectual); declaración de no estar en países con embargo de EE. UU.; Apple y subsidiarias como terceros beneficiarios.
12. Cambios a los términos.
13. Ley aplicable y contacto.

## Página web de borrado de cuenta

Pasos dentro de la app, vía alternativa sin la app (correo o formulario), plazo, tabla "qué se elimina / qué se conserva y por qué", y el aviso de que borrar no cancela la suscripción (con la ruta de cancelación en cada tienda).

## Dónde enlazarlos dentro de la app

| Lugar | Qué |
|---|---|
| Pantalla de bienvenida / login social | "Al continuar confirmas que eres mayor de N años y aceptas los **Términos** y la **Política de Privacidad**" con enlaces tocables |
| Registro con correo | **Casilla obligatoria** con el mismo texto; el backend rechaza el alta sin ella |
| Ajustes | Sección "Legal": Términos, Privacidad, Opciones de privacidad de anuncios (si aplica) |
| Paywall | Divulgaciones de suscripción + enlaces |
| Diálogo de borrar cuenta | Qué se borra y aviso de suscripción |

Las URLs deben ser las **de producción** aunque la app corra contra un servidor local (lo que se acepta es la versión publicada). Abrirlas en el navegador externo.

## Registro de aceptación

Guardar en el usuario `termsAcceptedAt` y `termsVersion` en cada alta (también en logins sociales, donde la aceptación es el aviso junto al botón). Mantener una constante de versión en el backend y una nota "al cambiar los textos legales actualizar: fecha de la página, constante de versión, manifiesto de privacidad iOS, formulario Data Safety".

## Consistencia entre páginas

- Un solo correo de contacto en todas las páginas, la app y las tiendas.
- Mismos nombres de secciones de la app que la UI real ("Ajustes → Cuenta → Eliminar cuenta").
- Pies de página que enlacen las tres páginas (términos, privacidad, borrado).

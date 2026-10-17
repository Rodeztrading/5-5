# Reglas de Firebase para 5-5 Finanzas

La configuración Firebase del cliente está en `config/firebase.ts`. Confirma el ID del proyecto allí y asegúrate de editar ese mismo proyecto en Firebase Console antes de publicar reglas.

## Qué protegen las reglas

- Solo una sesión autenticada puede acceder a datos financieros.
- Cada usuario puede leer documentos propios bajo `users/{su UID}/`; solo puede crear, actualizar y borrar cuando su suscripción tenga acceso vigente.
- El cliente solo tiene acceso a las colecciones financieras que usa la aplicación: `accounts`, `budgets`, `categories`, `fixedExpenseSkips`, `recurringDebts` y `transactions`.
- Las colecciones raíz heredadas y cualquier ruta no contemplada quedan bloqueadas.
- Un usuario puede leer su estado de suscripción, pero no modificarlo. Firebase Functions actualiza el documento tras verificar el estado directamente con Mercado Pago.
- Firebase Storage queda cerrado: la versión actual de 5-5 Finanzas no almacena archivos allí.

## Antes de publicar

### Inicio de sesión en Vercel

El inicio de sesión con Google utiliza `signInWithRedirect` y el dominio de autenticación original de Firebase (`trading-30254.firebaseapp.com`). Mantén ese valor en `config/firebase.ts`; no requiere crear otro cliente OAuth ni cambiar el callback de autenticación de Firebase.

En Firebase Console, agrega `dashboard-dusky-psi-50.vercel.app` a **Authentication → Configuración → Dominios autorizados**. Conserva los URI existentes de Firebase en el cliente OAuth asociado al proyecto; no los reemplaces por el dominio de Vercel.

1. En Firebase Console, abre **Firestore Database → Datos** y revisa si existen colecciones raíz llamadas `accounts`, `transactions`, `categories`, `budgets` o `recurringDebts`.
2. Si existen, crea y verifica una copia de seguridad. No ejecutes una migración desde el navegador que copie esos datos a cada usuario: las colecciones raíz no tienen necesariamente un propietario verificable.
3. Migra solo documentos cuya propiedad pueda asociarse de manera fiable con un UID, usando un proceso administrativo controlado. Comprueba las cantidades y los saldos antes de continuar. Si no puedes determinar el dueño, conserva esos documentos en la copia de seguridad hasta resolverlo.
4. Verifica que los datos actuales estén en `users/{uid}/{colección}/{documento}` y prueba la aplicación con las cuentas existentes.
5. Configura y prueba las Functions de pago antes de publicar reglas que exigen suscripción para escribir. Los usuarios sin suscripción conservan lectura de sus propios datos, pero no pueden cambiarlos.
6. Prueba las reglas en el emulador de Firebase o en **Rules Playground**: cada usuario puede leer sus propios datos; solo un usuario con suscripción vigente puede escribir; no puede acceder a datos de otro usuario; las colecciones raíz están denegadas; el cliente no puede escribir en `users/{uid}/subscriptions`.

La publicación de reglas no elimina datos. Permite que cada usuario lea sus propios datos y bloquea sus escrituras si no tiene un período pagado vigente. Verifica las rutas existentes y prueba las Functions con credenciales de prueba de Mercado Pago antes de publicar.

## Publicar reglas de Firestore

1. Abre [Firebase Console](https://console.firebase.google.com/) y selecciona el proyecto correcto.
2. Ve a **Firestore Database → Reglas**.
3. Reemplaza el contenido por el de [`firestore.rules`](./firestore.rules).
4. Ejecuta las pruebas anteriores y selecciona **Publicar**. También puedes desplegarlas con Firebase CLI mediante `firebase deploy --only firestore:rules`.

## Firebase Storage

La aplicación financiera no utiliza Storage. [`storage.rules`](./storage.rules) deniega todas las operaciones. Si más adelante se agrega carga de archivos financieros, define primero rutas por UID y reglas de acceso y validación específicas para esa función.

## Suscripción mensual con Mercado Pago

La aplicación ofrece el plan de **$9.900 COP al mes**, sin período de prueba. La tarjeta y el cobro recurrente se procesan en Mercado Pago; sus datos no se guardan en la aplicación.

El flujo usa Firebase Functions en `southamerica-east1`: una callable autenticada crea la suscripción alojada; el webhook valida la firma `x-signature`, consulta la suscripción/pago directamente en la API de Mercado Pago y, solo tras un pago aprobado, escribe el estado en `users/{uid}/subscriptions/mercadopago`. El documento no es editable por el cliente. Las reglas permiten leer datos financieros propios y solo permiten modificarlos mientras `accessUntil` siga vigente.

### Configuración y despliegue

1. Crea una aplicación de vendedor en [Tus integraciones de Mercado Pago](https://www.mercadopago.com.co/developers/panel/app) y confirma que la cuenta de vendedor y el producto de suscripciones estén habilitados en Colombia.
2. Usa primero credenciales de prueba. Nunca guardes el Access Token en el frontend, en Vercel ni en un archivo rastreado por Git.
3. Activa el plan **Blaze** en Firebase para habilitar Cloud Functions (pueden aplicarse cargos de uso). Instala Firebase CLI si no está disponible (`npm install -g firebase-tools`) e inicia sesión (`firebase login`). Confirma el proyecto `trading-30254` antes de desplegar.
4. Configura los secretos para Functions; la CLI los solicitará de forma segura:

   ```powershell
   firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
   firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET
   ```

   Usa el Access Token de prueba y el secreto de firma de Webhooks asociado a la aplicación. No compartas esos valores por chat.

5. Configura el parámetro `APP_BASE_URL` con el origen público HTTPS del sitio (por ejemplo, `https://tu-dominio.com`). Firebase CLI solicitará el valor al desplegar o puedes definirlo en `functions/.env.trading-30254`, archivo ignorado por Git.
   Para pruebas agrega `MERCADOPAGO_TEST_MODE=true` y `MERCADOPAGO_TEST_PAYER_EMAIL` en ese mismo archivo. El correo debe ser el que devolvió Mercado Pago al crear la cuenta **Comprador de prueba** colombiana. En modo de prueba, la integración usa ese comprador aunque el usuario de 5-5 haya iniciado sesión con Google. Antes de pasar a producción, quita esas variables, establece `MERCADOPAGO_TEST_MODE=false` y configura el Access Token productivo; así se utilizará el correo autenticado del usuario.
6. Instala dependencias y ejecuta las pruebas de las Functions:

   ```powershell
   npm --prefix functions install
   npm --prefix functions test
   ```

7. Despliega primero el backend:

   ```powershell
   firebase deploy --only functions
   ```

   El webhook queda en `https://southamerica-east1-trading-30254.cloudfunctions.net/mercadoPagoWebhook`. Mercado Pago recibe la URL en cada solicitud de suscripción.

8. El frontend muestra los datos en modo de lectura a usuarios sin suscripción y abre el checkout al intentar una acción que modifica información. La regla de Firestore es la protección real de las escrituras; no depende de una variable de entorno del frontend.
9. Con usuarios y tarjetas de prueba, comprueba el ciclo de suscripción, aprobación, denegación, cancelación y notificación repetida. Verifica que el usuario sin suscripción pueda leer sus datos propios, no pueda escribir y que el documento de suscripción no se pueda cambiar desde el cliente.
10. Solo después de esas pruebas, cambia a credenciales de producción y despliega las reglas con `firebase deploy --only firestore:rules`. Esto bloqueará las escrituras de cualquier cuenta sin un período pagado vigente. Avisa a los usuarios antes de iniciar cobros reales.

El despliegue de las reglas de Firestore y el despliegue del frontend son pasos separados. No publiques reglas de acceso pagado antes de tener Functions, credenciales y el checkout probados.

# Reglas de Firebase para 5-5 Finanzas

La configuración Firebase del cliente está en `config/firebase.ts`. Confirma el ID del proyecto allí y asegúrate de editar ese mismo proyecto en Firebase Console antes de publicar reglas.

## Qué protegen las reglas

- Solo una sesión autenticada puede acceder a datos financieros.
- Cada usuario solo puede leer, crear, actualizar y borrar documentos bajo `users/{su UID}/`.
- El cliente solo tiene acceso a las colecciones financieras que usa la aplicación: `accounts`, `budgets`, `categories`, `fixedExpenseSkips`, `recurringDebts` y `transactions`.
- Las colecciones raíz heredadas y cualquier ruta no contemplada quedan bloqueadas.
- Un usuario puede leer su estado de suscripción futuro, pero el cliente no puede modificarlo. Un backend confiable podrá actualizarlo con Firebase Admin SDK cuando se integre la pasarela.
- Firebase Storage queda cerrado: la versión actual de 5-5 Finanzas no almacena archivos allí.

## Antes de publicar

1. En Firebase Console, abre **Firestore Database → Datos** y revisa si existen colecciones raíz llamadas `accounts`, `transactions`, `categories`, `budgets` o `recurringDebts`.
2. Si existen, crea y verifica una copia de seguridad. No ejecutes una migración desde el navegador que copie esos datos a cada usuario: las colecciones raíz no tienen necesariamente un propietario verificable.
3. Migra solo documentos cuya propiedad pueda asociarse de manera fiable con un UID, usando un proceso administrativo controlado. Comprueba las cantidades y los saldos antes de continuar. Si no puedes determinar el dueño, conserva esos documentos en la copia de seguridad hasta resolverlo.
4. Verifica que los datos actuales estén en `users/{uid}/{colección}/{documento}` y prueba la aplicación con las cuentas existentes.
5. Prueba las reglas en el emulador de Firebase o en **Rules Playground**: usuario A accede a sus documentos; usuario B y usuarios anónimos no pueden acceder a los de A; las colecciones raíz están denegadas; el cliente no puede escribir en `users/{uid}/subscriptions`.

La publicación de reglas no elimina datos, pero bloquea el acceso del cliente a las rutas que no estén autorizadas. No publiques hasta verificar los datos heredados.

## Publicar reglas de Firestore

1. Abre [Firebase Console](https://console.firebase.google.com/) y selecciona el proyecto correcto.
2. Ve a **Firestore Database → Reglas**.
3. Reemplaza el contenido por el de [`firestore.rules`](./firestore.rules).
4. Ejecuta las pruebas anteriores y selecciona **Publicar**.

## Firebase Storage

La aplicación financiera no utiliza Storage. [`storage.rules`](./storage.rules) deniega todas las operaciones. Si más adelante se agrega carga de archivos financieros, define primero rutas por UID y reglas de acceso y validación específicas para esa función.

## Importante para suscripciones

Las reglas preparan `users/{uid}/subscriptions/{subscriptionId}` para que el usuario pueda leer su propio estado, sin modificarlo desde el navegador. Aún no hay integración de pagos: un webhook verificado en un backend deberá validar los eventos del proveedor y escribir el estado con Firebase Admin SDK. Las reglas de Firestore no sustituyen la validación de pagos del servidor.

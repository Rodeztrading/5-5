# 5-5 Finanzas

Aplicación web para administrar cuentas, ingresos, gastos, deudas e inversiones personales con distribución presupuestaria 5-5.

## Desarrollo local

Requisitos: Node.js 18 o superior y npm.

```bash
npm install
npm run dev
```

Vite inicia la aplicación en `http://localhost:3000`.

Para generar y probar una compilación de producción:

```bash
npm run build
npm run preview
```

## Firebase

La aplicación usa Firebase Authentication para iniciar sesión y Cloud Firestore para guardar la información financiera en `users/{uid}/...`. Revisa [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) antes de publicar las reglas de seguridad.

Las reglas del repositorio son plantillas fuente; no se aplican al proyecto Firebase automáticamente. Antes de publicarlas, verifica y respalda cualquier dato financiero que siga en colecciones raíz heredadas como `accounts`, `transactions`, `categories`, `budgets` o `recurringDebts`. Las reglas nuevas bloquean el acceso del cliente a esas colecciones sin borrar sus documentos.

## Funciones

- Cuentas y saldos personales.
- Registro de ingresos, gastos y transferencias.
- Presupuesto 5-5 por cubetas.
- Deudas, facturas pendientes e inversiones.
- Inicio de sesión con Google y experiencia instalable como PWA.

## Despliegue

La aplicación puede desplegarse en Vercel u otro hosting estático compatible con Vite. Configura en el hosting el mismo proyecto de Firebase usado por la aplicación y publica las reglas de Firestore descritas en [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).

# 🎯 RODEZ Trade Monitor

Aplicación profesional para monitorear y registrar trades de trading con integración Firebase.

![Version](https://img.shields.io/badge/version-3.1.0-blue)
![Firebase](https://img.shields.io/badge/Firebase-Connected-orange)
![React](https://img.shields.io/badge/React-19.2.0-61dafb)

## ✨ Características

- 📊 **Registro de Trades** - Guarda y visualiza tus operaciones de trading
- 🔥 **Firebase Integration** - Almacenamiento en la nube con Firestore y Storage
- 📸 **Upload de Imágenes** - Sube capturas de tus charts
- 🔄 **Migración Automática** - Migra datos desde localStorage a Firebase
- 🎨 **UI Moderna** - Interfaz profesional con diseño oscuro
- ⚡ **Tiempo Real** - Sincronización instantánea con Firebase

## 🚀 Demo

**Live Demo:** [https://dashboard-dusky-psi-50.vercel.app](https://dashboard-dusky-psi-50.vercel.app)

## 📋 Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Cuenta de Firebase

## 🛠️ Instalación

1. **Clonar el repositorio**

```bash
git clone https://github.com/Rodeztrading/Dashboard.git
cd Dashboard
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar Firebase**

- Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
- Habilita Firestore Database y Storage
- Copia `.env.example` a `.env`
- Agrega tus credenciales de Firebase en `.env`

```bash
cp .env.example .env
```

4. **Configurar reglas de Firebase**

Sigue las instrucciones en [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) para configurar las reglas de seguridad.

5. **Iniciar el servidor de desarrollo**

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🔧 Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run preview` - Previsualiza la build de producción

## 📁 Estructura del Proyecto

```
rodez-trade-monitor/
├── config/
│   └── firebase.ts          # Configuración de Firebase
├── services/
│   ├── firebaseService.ts   # Servicios de Firestore y Storage
│   └── geminiService.ts     # Servicio de IA (opcional)
├── components/
│   ├── RodezView.tsx    # Vista principal de trades
│   └── ...
├── utils/
│   └── ...
├── App.tsx                  # Componente principal
├── types.ts                 # Definiciones de TypeScript
├── firestore.rules          # Reglas de Firestore
├── storage.rules            # Reglas de Storage
└── .env.example             # Ejemplo de variables de entorno
```

## 🔐 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
VITE_FIREBASE_MEASUREMENT_ID=tu_measurement_id
```

## 🔥 Configuración de Firebase

### Firestore Database

1. Ve a Firebase Console → Firestore Database
2. Copia las reglas de `firestore.rules`
3. Publícalas en la consola

### Storage

1. Ve a Firebase Console → Storage
2. Copia las reglas de `storage.rules`
3. Publícalas en la consola

## 📦 Tecnologías Utilizadas

- **React 19.2** - Framework de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool
- **Firebase** - Backend as a Service
  - Firestore - Base de datos NoSQL
  - Storage - Almacenamiento de archivos
  - Analytics - Análisis de uso
- **Lucide React** - Iconos
- **TailwindCSS** - Estilos (via CSS)

## 🎯 Funcionalidades Principales

### Gestión de Trades

- Crear nuevos trades con detalles completos
- Visualizar historial de trades
- Actualizar información de trades existentes
- Eliminar trades

### Almacenamiento en la Nube

- Sincronización automática con Firebase
- Backup automático de datos
- Acceso desde cualquier dispositivo

### Upload de Imágenes

- Sube capturas de charts
- Almacenamiento seguro en Firebase Storage
- Optimización automática

## 🚀 Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio de GitHub con Vercel
2. Configura las variables de entorno en Vercel
3. Despliega automáticamente

### Otros Servicios

Compatible con:
- Netlify
- Firebase Hosting
- GitHub Pages (con configuración adicional)

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 👤 Autor

**Juan Rodez** - [@Rodeztrading](https://github.com/Rodeztrading)

## 🙏 Agradecimientos

- Firebase por el excelente BaaS
- React team por el increíble framework
- Comunidad de trading por el feedback

---

⭐ Si este proyecto te fue útil, considera darle una estrella en GitHub!

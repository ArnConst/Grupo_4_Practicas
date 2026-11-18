# TechSolve

TechSolve permite registrar y seguir tickets de soporte. El frontend y el backend están separados, y el mismo servidor puede ejecutarse localmente, en Render o como Netlify Server.

## Iniciar localmente

1. Abrí una terminal en la carpeta del proyecto.
2. Ejecutá npm install la primera vez.
3. Ejecutá npm start.
4. Abrí http://localhost:3000.

Los tickets locales se guardan en backend/data/tickets.json. Para volver a los datos iniciales, detené el servidor y borrá ese archivo.

## Cuentas de demostración

Todas usan la contraseña 1234.

- Técnico: tecnico
- Empleados: empleado, Constanza, Walter, Lautaro, Alejandro y Valeria

Son cuentas de demostración, no deben usarse en un sistema público real.

## API

Las rutas salvo salud e inicio de sesión requieren Authorization: Bearer TOKEN.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | /api/health | Comprobar que el servidor esté activo |
| POST | /api/auth/login | Iniciar sesión |
| GET | /api/auth/me | Consultar la sesión |
| POST | /api/auth/logout | Cerrar sesión |
| GET | /api/tickets | Listar tickets propios; el técnico ve todos |
| POST | /api/tickets | Crear un ticket como empleado |
| PATCH | /api/tickets/ID | Editar categoría o descripción; el técnico también cambia el estado |

En Netlify, los tickets y sesiones se guardan en Netlify Blobs para que sobrevivan cuando el servidor se apaga. En local, el servidor usa el archivo JSON. Netlify Blobs sirve para esta demo; para un sistema con muchos cambios simultáneos conviene una base de datos.

## Publicar en Netlify

Netlify Server está en acceso anticipado y requiere Node.js 24 o posterior. La configuración usa frontend como carpeta pública y detecta backend mediante netlify/server/index.mjs.

1. Subí los cambios a GitHub.
2. En Netlify, elegí Add new project e importá el repositorio.
3. Netlify leerá netlify.toml y desplegará el sitio y la API juntos.
4. Si el proyecto no encuentra Netlify Server, verificá que esté disponible para tu cuenta y plan.

## Publicar en Render

El archivo render.yaml configura un Web Service Node. En Render, elegí New +, después Blueprint, conectá GitHub y aplicá la configuración. Render y el servidor local usan backend/data/tickets.json; en Render gratuito ese archivo puede perderse tras reinicios o redespliegues.

## Postman

Importá postman/TechSolve.postman_collection.json. Para probar en Netlify, cambiá la variable baseUrl por la dirección publicada; en local usá http://localhost:3000.
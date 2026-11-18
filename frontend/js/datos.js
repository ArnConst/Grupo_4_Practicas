/* Sesión y acceso al backend compartidos por todas las páginas de TechSolve. */
window.TechSolve = (() => {
    "use strict";

    const TOKEN = "techsolveToken";
    const USUARIO = "techsolveUser";
    const ROL = "techsolveRol";

    function obtenerSesion() {
        const token = localStorage.getItem(TOKEN);
        const usuario = localStorage.getItem(USUARIO);
        const rol = localStorage.getItem(ROL);
        if (!token || !usuario || !["empleado", "tecnico"].includes(rol)) return null;
        return { usuario, rol };
    }

    function guardarSesion(datos) {
        localStorage.setItem(TOKEN, datos.token);
        localStorage.setItem(USUARIO, datos.user.usuario);
        localStorage.setItem(ROL, datos.user.rol);
    }

    function limpiarSesion() {
        localStorage.removeItem(TOKEN);
        localStorage.removeItem(USUARIO);
        localStorage.removeItem(ROL);
    }

    async function solicitar(ruta, opciones = {}) {
        const { auth: requiereToken = true, ...configuracion } = opciones;
        const encabezados = { ...(configuracion.headers || {}) };
        if (configuracion.body !== undefined) encabezados["Content-Type"] = "application/json";

        const token = localStorage.getItem(TOKEN);
        if (token && requiereToken) encabezados.Authorization = "Bearer " + token;

        const respuesta = await fetch(ruta, { ...configuracion, headers: encabezados });
        if (respuesta.status === 204) return null;

        let resultado;
        try {
            resultado = await respuesta.json();
        } catch {
            resultado = {};
        }

        if (!respuesta.ok) {
            if (respuesta.status === 401 && token) limpiarSesion();
            throw new Error(resultado.error || "No se pudo completar la solicitud.");
        }
        return resultado;
    }

    async function iniciarSesion(usuario, clave) {
        const resultado = await solicitar("/api/auth/login", {
            method: "POST",
            auth: false,
            body: JSON.stringify({ usuario, clave })
        });
        guardarSesion(resultado);
        return resultado.user;
    }

    async function cerrarSesion() {
        try {
            if (localStorage.getItem(TOKEN)) {
                await solicitar("/api/auth/logout", { method: "POST" });
            }
        } catch {
            // Se borra la sesión local aunque el servidor ya no reconozca el token.
        } finally {
            limpiarSesion();
            const enlaceLogin = document.querySelector('nav a[href$="login.html"]');
            window.location.href = enlaceLogin ? enlaceLogin.getAttribute("href") : "login.html";
        }
    }

    function requerirSesion(rol) {
        const sesion = obtenerSesion();
        if (!sesion) {
            window.location.replace("login.html");
            return null;
        }
        if (rol && sesion.rol !== rol && sesion.rol !== "tecnico") {
            window.location.replace("mis-tickets.html");
            return null;
        }
        return sesion;
    }

    function puedeEditar(ticket) {
        const sesion = obtenerSesion();
        return Boolean(sesion && (
            sesion.rol === "tecnico" ||
            (sesion.rol === "empleado" && ticket.usuario === sesion.usuario)
        ));
    }

    async function obtenerTickets() {
        return solicitar("/api/tickets");
    }

    async function crearTicket(datos) {
        return solicitar("/api/tickets", {
            method: "POST",
            body: JSON.stringify(datos)
        });
    }

    async function actualizarTicket(id, cambios) {
        return solicitar("/api/tickets/" + encodeURIComponent(id), {
            method: "PATCH",
            body: JSON.stringify(cambios)
        });
    }

    return {
        obtenerSesion,
        requerirSesion,
        cerrarSesion,
        iniciarSesion,
        obtenerTickets,
        crearTicket,
        actualizarTicket,
        puedeEditar
    };
})();
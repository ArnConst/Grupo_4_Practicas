"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const BACKEND_DIR = __dirname;
const FRONTEND_DIR = path.resolve(BACKEND_DIR, "..", "frontend");
const DATA_FILE = path.join(BACKEND_DIR, "data", "tickets.json");
const SEED_TICKETS = require("./data/datos.json");
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const USERS = [
    { usuario: "tecnico", clave: "1234", rol: "tecnico" },
    { usuario: "empleado", clave: "1234", rol: "empleado" },
    ...["Constanza", "Walter", "Lautaro", "Alejandro", "Valeria"]
        .map(usuario => ({ usuario, clave: "1234", rol: "empleado" }))
];
const CATEGORIAS = ["Hardware", "Software", "Red", "Otros"];
const ESTADOS = ["Abierto", "En proceso", "Pendiente", "Resuelto", "Cerrado"];
const sesionesLocales = new Map();
let ticketsLocales;
let netlifyStore = null;

function configureNetlifyStore(store) {
    netlifyStore = store;
}

function normalizarSemilla() {
    const usuarios = new Set(USERS.map(user => user.usuario));
    return SEED_TICKETS.map(ticket => ({
        ...ticket,
        usuario: usuarios.has(ticket.usuario) ? ticket.usuario : "empleado"
    }));
}

function cargarTicketsLocales() {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
        const datos = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        if (!Array.isArray(datos)) throw new Error("backend/data/tickets.json debe contener una lista.");
        return datos;
    }
    const iniciales = normalizarSemilla();
    fs.writeFileSync(DATA_FILE, JSON.stringify(iniciales, null, 2) + "\n", "utf8");
    return iniciales;
}

function obtenerTicketsLocales() {
    if (!ticketsLocales) ticketsLocales = cargarTicketsLocales();
    return ticketsLocales;
}

async function obtenerTickets() {
    if (!netlifyStore) return obtenerTicketsLocales();

    let { blobs } = await netlifyStore.list({ prefix: "tickets/" });
    if (blobs.length === 0) {
        for (const ticket of normalizarSemilla()) {
            await netlifyStore.setJSON("tickets/" + ticket.id + ".json", ticket, { onlyIfNew: true });
        }
        ({ blobs } = await netlifyStore.list({ prefix: "tickets/" }));
    }

    const registros = await Promise.all(blobs.map(blob =>
        netlifyStore.get(blob.key, { type: "json", consistency: "strong" })
    ));
    return registros.filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));
}

async function guardarTicket(ticket, nuevo = false) {
    const clave = "tickets/" + ticket.id + ".json";
    if (netlifyStore) {
        const resultado = await netlifyStore.setJSON(clave, ticket, nuevo ? { onlyIfNew: true } : {});
        return !nuevo || resultado.modified;
    }

    const tickets = obtenerTicketsLocales();
    const indice = tickets.findIndex(item => item.id === ticket.id);
    if (indice === -1) tickets.push(ticket);
    else tickets[indice] = ticket;
    fs.writeFileSync(DATA_FILE, JSON.stringify(tickets, null, 2) + "\n", "utf8");
    return true;
}

function idSiguiente(tickets) {
    const mayor = Math.max(0, ...tickets.map(ticket => {
        const match = /^TS(\d+)$/.exec(String(ticket.id || ""));
        return match ? Number(match[1]) : 0;
    }));
    return "TS" + String(mayor + 1).padStart(2, "0");
}

function responder(res, status, body) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    res.end(body === undefined ? "" : JSON.stringify(body));
}

function leerJson(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        let excedido = false;
        req.on("data", chunk => {
            if (excedido) return;
            raw += chunk;
            if (Buffer.byteLength(raw, "utf8") > 1024 * 1024) {
                excedido = true;
                reject(new Error("El cuerpo de la solicitud supera 1 MB."));
                req.resume();
            }
        });
        req.on("end", () => {
            if (excedido) return;
            if (!raw) return resolve({});
            try {
                resolve(JSON.parse(raw));
            } catch {
                reject(new Error("El cuerpo debe ser un JSON válido."));
            }
        });
        req.on("error", reject);
    });
}

function tokenDe(req) {
    const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
    return match ? match[1] : null;
}

async function buscarSesion(req) {
    const token = tokenDe(req);
    if (!token) return null;

    let sesion;
    if (netlifyStore) {
        sesion = await netlifyStore.get("sessions/" + token + ".json", {
            type: "json",
            consistency: "strong"
        });
    } else {
        sesion = sesionesLocales.get(token);
    }

    if (!sesion) return null;
    if (sesion.expira <= Date.now()) {
        if (netlifyStore) await netlifyStore.delete("sessions/" + token + ".json");
        else sesionesLocales.delete(token);
        return null;
    }
    return { usuario: sesion.usuario, rol: sesion.rol };
}

async function exigirSesion(req, res) {
    const sesion = await buscarSesion(req);
    if (!sesion) responder(res, 401, { error: "Iniciá sesión para continuar." });
    return sesion;
}

function archivo(req, res, ruta) {
    let nombre;
    try {
        nombre = decodeURIComponent(ruta === "/" ? "/index.html" : ruta);
    } catch {
        res.writeHead(400);
        return res.end("Ruta inválida.");
    }

    const target = path.resolve(FRONTEND_DIR, "." + nombre);
    if (target !== FRONTEND_DIR && !target.startsWith(FRONTEND_DIR + path.sep)) {
        res.writeHead(403);
        return res.end("Acceso denegado.");
    }

    let stat;
    try {
        stat = fs.statSync(target);
    } catch {
        res.writeHead(404);
        return res.end("No se encontró el archivo.");
    }
    if (!stat.isFile()) {
        res.writeHead(404);
        return res.end("No se encontró el archivo.");
    }

    const tipos = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".svg": "image/svg+xml"
    };
    res.writeHead(200, { "Content-Type": tipos[path.extname(target).toLowerCase()] || "application/octet-stream" });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(target).pipe(res);
}

async function api(req, res, url) {
    const ruta = url.pathname;

    if (ruta === "/api/health" && req.method === "GET") {
        return responder(res, 200, { estado: "ok", servicio: "TechSolve API" });
    }

    if (ruta === "/api/auth/login" && req.method === "POST") {
        const datos = await leerJson(req);
        const usuario = USERS.find(item => item.usuario === datos.usuario && item.clave === datos.clave);
        if (!usuario) return responder(res, 401, { error: "Usuario o contraseña incorrectos." });

        const token = crypto.randomBytes(32).toString("hex");
        const sesion = {
            usuario: usuario.usuario,
            rol: usuario.rol,
            expira: Date.now() + 8 * 60 * 60 * 1000
        };
        if (netlifyStore) await netlifyStore.setJSON("sessions/" + token + ".json", sesion);
        else sesionesLocales.set(token, sesion);
        return responder(res, 200, {
            token,
            user: { usuario: sesion.usuario, rol: sesion.rol }
        });
    }

    const sesion = await exigirSesion(req, res);
    if (!sesion) return;

    if (ruta === "/api/auth/me" && req.method === "GET") {
        return responder(res, 200, { user: sesion });
    }

    if (ruta === "/api/auth/logout" && req.method === "POST") {
        const token = tokenDe(req);
        if (netlifyStore) await netlifyStore.delete("sessions/" + token + ".json");
        else sesionesLocales.delete(token);
        res.writeHead(204);
        return res.end();
    }

    if (ruta === "/api/tickets" && req.method === "GET") {
        const tickets = await obtenerTickets();
        const visibles = sesion.rol === "tecnico"
            ? tickets
            : tickets.filter(ticket => ticket.usuario === sesion.usuario);
        return responder(res, 200, visibles);
    }

    if (ruta === "/api/tickets" && req.method === "POST") {
        if (sesion.rol !== "empleado") {
            return responder(res, 403, { error: "Solo un empleado puede registrar tickets." });
        }
        const datos = await leerJson(req);
        if (typeof datos.categoria !== "string" || !CATEGORIAS.includes(datos.categoria.trim())) {
            return responder(res, 400, { error: "La categoría no es válida." });
        }
        if (typeof datos.descripcion !== "string" || !datos.descripcion.trim()) {
            return responder(res, 400, { error: "La descripción es obligatoria." });
        }
        if (datos.descripcion.trim().length > 1000) {
            return responder(res, 400, { error: "La descripción no puede superar 1000 caracteres." });
        }

        let tickets = await obtenerTickets();
        let ticket;
        for (let intento = 0; intento < 10; intento++) {
            ticket = {
                id: idSiguiente(tickets),
                usuario: sesion.usuario,
                categoria: datos.categoria.trim(),
                descripcion: datos.descripcion.trim(),
                estado: "Pendiente",
                prioridad: "Media"
            };
            if (await guardarTicket(ticket, true)) {
                return responder(res, 201, ticket);
            }
            tickets = await obtenerTickets();
        }
        return responder(res, 503, { error: "No se pudo asignar un identificador. Intentá otra vez." });
    }

    const match = /^\/api\/tickets\/([^/]+)$/.exec(ruta);
    if (match && req.method === "PATCH") {
        const id = decodeURIComponent(match[1]);
        const tickets = await obtenerTickets();
        const ticket = tickets.find(item => item.id === id);
        if (!ticket) return responder(res, 404, { error: "No se encontró el ticket." });
        if (sesion.rol !== "tecnico" && ticket.usuario !== sesion.usuario) {
            return responder(res, 403, { error: "No tenés permiso para modificar este ticket." });
        }

        const cambios = await leerJson(req);
        if ("categoria" in cambios) {
            if (typeof cambios.categoria !== "string" || !CATEGORIAS.includes(cambios.categoria.trim())) {
                return responder(res, 400, { error: "La categoría no es válida." });
            }
            ticket.categoria = cambios.categoria.trim();
        }
        if ("descripcion" in cambios) {
            if (typeof cambios.descripcion !== "string" || !cambios.descripcion.trim()) {
                return responder(res, 400, { error: "La descripción es obligatoria." });
            }
            if (cambios.descripcion.trim().length > 1000) {
                return responder(res, 400, { error: "La descripción no puede superar 1000 caracteres." });
            }
            ticket.descripcion = cambios.descripcion.trim();
        }
        if ("estado" in cambios) {
            if (sesion.rol !== "tecnico") {
                return responder(res, 403, { error: "Solo un técnico puede cambiar el estado." });
            }
            if (!ESTADOS.includes(cambios.estado)) {
                return responder(res, 400, { error: "El estado no es válido." });
            }
            ticket.estado = cambios.estado;
        }
        if (!["categoria", "descripcion", "estado"].some(campo => campo in cambios)) {
            return responder(res, 400, { error: "Indicá al menos un campo para modificar." });
        }

        await guardarTicket(ticket);
        return responder(res, 200, ticket);
    }

    return responder(res, 404, { error: "No se encontró esa ruta de la API." });
}

async function handleRequest(req, res) {
    const url = new URL(req.url, "http://localhost");
    try {
        if (url.pathname.startsWith("/api/")) return await api(req, res, url);
        if (req.method === "GET" || req.method === "HEAD") return archivo(req, res, url.pathname);
        return responder(res, 405, { error: "Método no permitido." });
    } catch (error) {
        if (!res.headersSent) {
            const status = error.message.includes("1 MB") ? 413 : 500;
            responder(res, status, { error: error.message || "Ocurrió un error." });
        }
    }
}

if (require.main === module) {
    const server = http.createServer(handleRequest);
    server.listen(PORT, HOST, () => {
        console.log("TechSolve disponible en http://localhost:" + PORT);
        console.log("API disponible en http://localhost:" + PORT + "/api");
    });
}

module.exports = { handleRequest, configureNetlifyStore };
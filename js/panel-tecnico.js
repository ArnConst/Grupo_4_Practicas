(() => {
    "use strict";

    if (!TechSolve.requerirSesion("tecnico")) return;
    const contenedor = document.getElementById("panelTicketsContainer");

    async function mostrarTickets() {
        try {
            const tickets = await TechSolve.obtenerTickets();
            contenedor.textContent = tickets.length ? "" : "No hay tickets registrados.";
            tickets.forEach(ticket => {
                const parrafo = document.createElement("p");
                parrafo.textContent =
                    "Categoría: " + ticket.categoria +
                    " | Problema: " + ticket.descripcion +
                    " | Estado: " + ticket.estado;
                contenedor.appendChild(parrafo);
            });
        } catch (error) {
            contenedor.textContent = "No se pudieron cargar los tickets. " + error.message;
        }
    }

    mostrarTickets();
})();

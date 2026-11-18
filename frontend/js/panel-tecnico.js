(() => {
    "use strict";

    if (!TechSolve.requerirSesion("tecnico")) return;
    const tabla = document.getElementById("panelTicketsContainer");
    const mensaje = document.getElementById("panelTicketsMessage");
    const estados = ["Abierto", "En proceso", "Pendiente", "Resuelto", "Cerrado"];

    function crearSelectorEstado(ticket) {
        const selector = document.createElement("select");
        selector.setAttribute("aria-label", "Estado del ticket " + ticket.id);
        selector.dataset.estado = ticket.estado;

        const opciones = estados.includes(ticket.estado)
            ? estados
            : estados.concat(ticket.estado);
        opciones.forEach(estado => {
            selector.add(new Option(estado, estado, false, estado === ticket.estado));
        });

        selector.addEventListener("change", async () => {
            const nuevoEstado = selector.value;
            selector.disabled = true;
            mensaje.textContent = "";

            try {
                await TechSolve.actualizarTicket(ticket.id, { estado: nuevoEstado });
                selector.dataset.estado = nuevoEstado;
                mensaje.textContent = "Estado actualizado correctamente.";
            } catch (error) {
                selector.value = selector.dataset.estado;
                mensaje.textContent = "No se pudo actualizar el estado. " + error.message;
            } finally {
                selector.disabled = false;
            }
        });

        return selector;
    }

    async function mostrarTickets() {
        try {
            const tickets = await TechSolve.obtenerTickets();
            tabla.replaceChildren();

            if (!tickets.length) {
                const celda = tabla.insertRow().insertCell();
                celda.colSpan = 5;
                celda.textContent = "No hay tickets registrados.";
                return;
            }

            tickets.forEach(ticket => {
                const fila = tabla.insertRow();
                [ticket.id, ticket.categoria, ticket.descripcion]
                    .forEach(valor => { fila.insertCell().textContent = valor; });
                fila.insertCell().appendChild(crearSelectorEstado(ticket));
                fila.insertCell().textContent = ticket.prioridad;
            });
        } catch (error) {
            tabla.replaceChildren();
            const celda = tabla.insertRow().insertCell();
            celda.colSpan = 5;
            celda.textContent = "No se pudieron cargar los tickets.";
            mensaje.textContent = error.message;
        }
    }

    mostrarTickets();
})();
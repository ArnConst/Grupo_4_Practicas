(() => {
    "use strict";

    if (!TechSolve.requerirSesion("empleado")) return;
    const formulario = document.getElementById("formularioTicket");
    const boton = formulario.querySelector('button[type="submit"]');
    const descripcion = document.getElementById("descripcion");

    descripcion.addEventListener("input", () => descripcion.setCustomValidity(""));

    formulario.addEventListener("submit", async event => {
        event.preventDefault();
        if (!TechSolve.requerirSesion("empleado")) return;

        const categoria = document.getElementById("categoria");
        descripcion.setCustomValidity(descripcion.value.trim() ? "" : "Describí el problema.");
        if (!formulario.reportValidity()) return;

        boton.disabled = true;
        try {
            const ticket = await TechSolve.crearTicket({
                categoria: categoria.options[categoria.selectedIndex].text,
                descripcion: descripcion.value.trim()
            });
            alert("Ticket " + ticket.id + " registrado correctamente.");
            formulario.reset();
        } catch (error) {
            alert("No se pudo registrar el ticket. " + error.message);
        } finally {
            boton.disabled = false;
        }
    });
})();
(() => {
    "use strict";

    const formulario = document.getElementById("loginForm");
    const mensaje = document.getElementById("errorMessage");
    const boton = formulario.querySelector('button[type="submit"]');

    formulario.addEventListener("submit", async event => {
        event.preventDefault();
        mensaje.textContent = "";
        boton.disabled = true;

        const usuario = document.getElementById("user").value.trim();
        const clave = document.getElementById("password").value;

        try {
            const sesion = await TechSolve.iniciarSesion(usuario, clave);
            window.location.href = sesion.rol === "tecnico"
                ? "panel-tecnico.html"
                : "mis-tickets.html";
        } catch (error) {
            mensaje.textContent = error.message;
        } finally {
            boton.disabled = false;
        }
    });
})();
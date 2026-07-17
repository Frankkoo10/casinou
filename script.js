// 1. Configuración de Supabase
const supabaseUrl = 'https://wgqqbahoalozgfukioza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndncXFiYWhvYWxvemdmdWtpb3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTA3OTYsImV4cCI6MjA5OTgyNjc5Nn0.v_kpYceS8ceIUBNaLLHjfyBeFA2Y3lDRy7Yn6cb5Uz8';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Referencias a los contenedores
const authSection = document.getElementById('auth-section');
const juegosSection = document.getElementById('juegos-section');
const header = document.getElementById('user-header');
const userEmailSpan = document.getElementById('user-email');

// ==========================================
// CONTROL DE ESTADO DE SESIÓN (AUTH)
// ==========================================

// Escucha automáticamente si el usuario inicia o cierra sesión
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        // Usuario logueado: Ocultar login, mostrar juegos
        authSection.classList.add('hidden');
        juegosSection.classList.remove('hidden');
        header.classList.remove('hidden');
        userEmailSpan.innerText = `Jugador: ${session.user.email}`;
        
        // Cargar los juegos de la base de datos
        cargarJuegos();
    } else {
        // Usuario desconectado: Mostrar login, ocultar juegos
        authSection.classList.remove('hidden');
        juegosSection.classList.add('hidden');
        header.classList.add('hidden');
        mostrarFormulario('login-box');
    }
});

// Función para alternar entre los formularios (Login / Register / Reset)
function mostrarFormulario(idFormulario) {
    document.getElementById('login-box').classList.add('hidden');
    document.getElementById('register-box').classList.add('hidden');
    document.getElementById('reset-box').classList.add('hidden');
    
    // Limpiar mensajes de error
    document.querySelectorAll('.error-msg, .success-msg').forEach(el => el.innerText = '');
    
    document.getElementById(idFormulario).classList.remove('hidden');
}

// ==========================================
// FUNCIONES DE USUARIO
// ==========================================

async function crearCuenta() {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const errorMsg = document.getElementById('reg-error');
    const successMsg = document.getElementById('reg-success');

    errorMsg.innerText = '';
    successMsg.innerText = 'Creando cuenta...';

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
    });

    if (error) {
        successMsg.innerText = '';
        errorMsg.innerText = "Error: " + error.message;
    } else {
        errorMsg.innerText = '';
        successMsg.innerText = '¡Cuenta creada! Verifica tu correo (si tienes la confirmación activada) o inicia sesión.';
    }
}

async function iniciarSesion() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');

    errorMsg.innerText = 'Iniciando sesión...';

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        errorMsg.innerText = "Error: Correo o contraseña incorrectos.";
    } else {
        errorMsg.innerText = '';
        // onAuthStateChange se encargará de mostrar los juegos automáticamente
    }
}

async function cerrarSesion() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error al cerrar sesión:", error.message);
}

async function recuperarPassword() {
    const email = document.getElementById('reset-email').value;
    const errorMsg = document.getElementById('reset-error');
    const successMsg = document.getElementById('reset-success');

    errorMsg.innerText = '';
    successMsg.innerText = 'Enviando...';

    const { data, error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
        successMsg.innerText = '';
        errorMsg.innerText = "Error: " + error.message;
    } else {
        errorMsg.innerText = '';
        successMsg.innerText = 'Te hemos enviado un correo con el enlace para restablecer tu contraseña.';
    }
}

// ==========================================
// FUNCIONES DE LA BASE DE DATOS
// ==========================================

async function cargarJuegos() {
    const contenedor = document.getElementById('contenedor-juegos');
    contenedor.innerHTML = '<p>Cargando juegos...</p>';

    try {
        // Hacemos la consulta a la tabla 'juegos'
        const { data: juegos, error } = await supabase
            .from('juegos')
            .select('*'); 

        if (error) throw error;

        contenedor.innerHTML = ''; // Limpiamos

        // Renderizamos cada juego en el HTML
        juegos.forEach(juego => {
            const gameCard = `
                <a href="${juego.url_juego}" class="game-card">
                    <img src="${juego.url_imagen}" alt="${juego.nombre}">
                    <span>${juego.nombre.toUpperCase()}</span>
                </a>
            `;
            contenedor.innerHTML += gameCard;
        });

    } catch (error) {
        console.error("Error al cargar los juegos:", error);
        contenedor.innerHTML = '<p>Error al cargar el lobby. Intenta recargar la página.</p>';
    }
}
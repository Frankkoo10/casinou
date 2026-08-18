const supabaseUrl = 'https://wgqqbahoalozgfukioza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndncXFiYWhvYWxvemdmdWtpb3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTA3OTYsImV4cCI6MjA5OTgyNjc5Nn0.v_kpYceS8ceIUBNaLLHjfyBeFA2Y3lDRy7Yn6cb5Uz8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const authSection = document.getElementById('auth-section');
const juegosSection = document.getElementById('juegos-section');
const juegosVivoSection = document.getElementById('juegos-vivo-section');
const deportesSection = document.getElementById('deportes-section');
const rankingSection = document.getElementById('ranking-section');
const header = document.getElementById('user-header');
const userEmailSpan = document.getElementById('user-email');

let currentUserId = null;
let currentSaldo = 0;
let totalApostadoGlobal = 0;

// =========================================================================
// VARIABLES GLOBALES Y CONFIGURACIÓN UNIFICADA DE DEPORTES
// =========================================================================
let timerInterval = null;
let equiposGlobales = [];
let jugadoresGlobales = [];
let partidosActuales = [];
let apuestasUsuario = []; 
let ticketSelecciones = []; 
let ligasDisponibles = [];
let ligaActual = '';
let deporteActual = localStorage.getItem('deporteActual') || 'Futbol'; 

const globalBetTime = 90; 
const globalPlayTime = 95; 
const globalCycleLength = globalBetTime + globalPlayTime;

const configDeportes = {
    Futbol: { playTime: 95 },     
    Basketball: { playTime: 48 }, 
    Tenis: { playTime: 80 },      
    UFC: { playTime: 25 }         
};

// NUEVA FUNCIÓN PARA MOSTRAR/OCULTAR LA CANCHA 2D
window.toggleCancha = function(partidoId) {
    const wrapper = document.getElementById(`cancha-wrapper-${partidoId}`);
    if (wrapper) wrapper.classList.toggle('hidden');
};

let globalRoundId = -1;
let faseApuestasAbierta = true;

window.navegarA = function(sectionId) {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if(target) target.classList.add('active');

    juegosSection.classList.add('hidden');
    juegosVivoSection.classList.add('hidden');
    deportesSection.classList.add('hidden');
    rankingSection.classList.add('hidden');

    localStorage.setItem('activeSection', sectionId);

    if (sectionId === 'btn-nav-juegos') {
        juegosSection.classList.remove('hidden');
    } else if (sectionId === 'btn-nav-juegos-vivo') {
        juegosVivoSection.classList.remove('hidden');
    } else if (sectionId === 'btn-nav-deportes') {
        deportesSection.classList.remove('hidden');
        let savedDeporte = localStorage.getItem('deporteActual') || 'Futbol';
        deporteActual = savedDeporte;
        inicializarDeportes();
        cambiarDeporte(savedDeporte);
    } else if (sectionId === 'btn-nav-ranking') {
        rankingSection.classList.remove('hidden');
        cargarRanking();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login').addEventListener('click', iniciarSesion);
    document.getElementById('btn-register').addEventListener('click', crearCuenta);
    document.getElementById('btn-reset').addEventListener('click', recuperarPassword);
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

    document.getElementById('link-to-register').addEventListener('click', () => mostrarFormulario('register-box'));
    document.getElementById('link-to-reset').addEventListener('click', () => mostrarFormulario('reset-box'));
    document.getElementById('link-to-login-1').addEventListener('click', () => mostrarFormulario('login-box'));
    document.getElementById('link-to-login-2').addEventListener('click', () => mostrarFormulario('login-box'));

    document.getElementById('btn-confirm-deposit').addEventListener('click', autoRecarga);

    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); 
            navegarA(e.target.id);
        });
    });
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUserId = session.user.id;
        authSection.classList.add('hidden');
        header.classList.remove('hidden');
        userEmailSpan.innerText = `Jugador: ${session.user.email}`;
       
        const savedSection = localStorage.getItem('activeSection') || 'btn-nav-juegos';
        navegarA(savedSection);

        cargarSaldoYDatos(session.user.id);
        cargarJuegos();
        cargarJuegosVivo();
        cargarHistorialDesdeBD();
    } else {
        currentUserId = null;
        detenerDeportes();
        authSection.classList.remove('hidden');
        juegosSection.classList.add('hidden');
        juegosVivoSection.classList.add('hidden');
        deportesSection.classList.add('hidden');
        rankingSection.classList.add('hidden');
        header.classList.add('hidden');
        mostrarFormulario('login-box');
    }
});

function mostrarFormulario(idFormulario) {
    document.getElementById('login-box').classList.add('hidden');
    document.getElementById('register-box').classList.add('hidden');
    document.getElementById('reset-box').classList.add('hidden');
    document.querySelectorAll('.error-msg, .success-msg').forEach(el => el.innerText = '');
    document.getElementById(idFormulario).classList.remove('hidden');
}

async function crearCuenta() {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const errorMsg = document.getElementById('reg-error');
    const successMsg = document.getElementById('reg-success');
    errorMsg.innerText = ''; successMsg.innerText = 'Creando cuenta...';
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) { errorMsg.innerText = "Error: " + error.message; } 
    else { successMsg.innerText = '¡Cuenta creada! Verifica tu correo o inicia sesión.'; }
}

async function iniciarSesion() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');
    errorMsg.innerText = 'Iniciando sesión...';
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { errorMsg.innerText = "Error: Correo o contraseña incorrectos."; } 
    else { errorMsg.innerText = ''; }
}

async function cerrarSesion() { await supabaseClient.auth.signOut(); }

async function recuperarPassword() {
    const email = document.getElementById('reset-email').value;
    const errorMsg = document.getElementById('reset-error');
    const successMsg = document.getElementById('reset-success');
    errorMsg.innerText = ''; successMsg.innerText = 'Enviando...';
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email);
    if (error) { errorMsg.innerText = "Error: " + error.message; } 
    else { successMsg.innerText = 'Te hemos enviado un correo con el enlace.'; }
}

function autoRecarga() {
    if (!currentUserId) return;
    const now = Date.now();
    const lastDeposit = localStorage.getItem('last_deposit_time_' + currentUserId) || 0;
    const cooldown = 5 * 60 * 1000;

    if (now - lastDeposit < cooldown) {
        const timeLeft = Math.ceil((cooldown - (now - lastDeposit)) / 60000);
        document.getElementById('deposit-msg').innerText = `Espera ${timeLeft} min.`;
        document.getElementById('deposit-msg').style.color = '#ff4d4d';
        return;
    }

    const amount = parseFloat(document.getElementById('deposit-amount').value);
    if (isNaN(amount) || amount <= 0 || amount > 10000) {
        document.getElementById('deposit-msg').innerText = 'Monto inválido (Máx $10,000).';
        document.getElementById('deposit-msg').style.color = '#ff4d4d';
        return;
    }

    localStorage.setItem('last_deposit_time_' + currentUserId, now);
    actualizarSaldoBD(amount);
    
    document.getElementById('deposit-msg').innerText = '¡Recarga exitosa!';
    document.getElementById('deposit-msg').style.color = '#2ecc71';
    
    setTimeout(() => {
        document.getElementById('deposit-msg').innerText = '';
    }, 2000);
}

async function cargarJuegos() {
    const contenedor = document.getElementById('contenedor-juegos');
    contenedor.innerHTML = '<p>Cargando juegos...</p>';
    try {
        const { data: juegos, error } = await supabaseClient.from('juegos').select('*'); 
        if (error) throw error;
        contenedor.innerHTML = ''; 
        juegos.forEach(juego => {
            contenedor.innerHTML += `
                <a href="${juego.url_juego}" class="game-card">
                    <img src="${juego.url_imagen}" alt="${juego.nombre}">
                    <span>${juego.nombre.toUpperCase()}</span>
                </a>`;
        });
    } catch (error) { contenedor.innerHTML = '<p>Error al cargar el lobby.</p>'; }
}

async function cargarJuegosVivo() {
    const contenedor = document.getElementById('contenedor-juegos-vivo');
    contenedor.innerHTML = '<p>Cargando juegos en vivo...</p>';
    try {
        const { data: juegosVivo, error } = await supabaseClient.from('juegos_en_vivo').select('*'); 
        if (error) throw error;
        contenedor.innerHTML = ''; 
        juegosVivo.forEach(juego => {
            contenedor.innerHTML += `
                <a href="${juego.url_juego}" class="game-card">
                    <img src="${juego.url_imagen}" alt="${juego.nombre}">
                    <span>${juego.nombre.toUpperCase()}</span>
                </a>`;
        });
    } catch (error) { contenedor.innerHTML = '<p>Error al cargar el lobby de juegos en vivo.</p>'; }
}

async function cargarSaldoYDatos(userId) {
    const balanceSpan = document.getElementById('user-balance');
    balanceSpan.innerText = 'Cargando saldo...';
    const { data, error } = await supabaseClient.from('perfiles').select('saldo, total_apostado').eq('id', userId).single(); 
    if (data) {
        currentSaldo = data.saldo || 0;
        totalApostadoGlobal = data.total_apostado || 0;
        balanceSpan.innerText = `Saldo: $${currentSaldo.toFixed(2)}`;
    }
}

async function actualizarSaldoBD(monto) {
    if (!currentUserId) return;
    currentSaldo += monto;
    document.getElementById('user-balance').innerText = `Saldo: $${currentSaldo.toFixed(2)}`;
    await supabaseClient.from('perfiles').update({ saldo: currentSaldo }).eq('id', currentUserId);
}

async function sumarTotalApostado(monto) {
    if (!currentUserId) return;
    totalApostadoGlobal += monto;
    await supabaseClient.from('perfiles').update({ total_apostado: totalApostadoGlobal }).eq('id', currentUserId);
}

async function cargarRanking() {
    const contenedor = document.getElementById('contenedor-ranking');
    contenedor.innerHTML = '<p>Cargando ranking...</p>';
    try {
        const { data, error } = await supabaseClient.from('perfiles')
            .select('id, total_apostado, saldo')
            .order('total_apostado', { ascending: false })
            .limit(10);
            
        if (error) throw error;
        if (!data || data.length === 0) {
            contenedor.innerHTML = '<p>No hay datos suficientes para el ranking.</p>';
            return;
        }

        let html = '<table class="ranking-table"><tr><th>Top</th><th>Jugador</th><th>Volumen Apostado</th><th>Nivel Ludopatía</th></tr>';
        
        data.forEach((perfil, index) => {
            let idCorto = perfil.id.substring(0, 8) + '***';
            let medalla = index === 0 ? '<img src="imagen_oro.png" class="custom-emoji" alt="Oro">' : index === 1 ? '<img src="imagen_plata.png" class="custom-emoji" alt="Plata">' : index === 2 ? '<img src="imagen_bronce.png" class="custom-emoji" alt="Bronce">' : `${index + 1}º`;
            let apostado = perfil.total_apostado || 0;
            let saldoActual = perfil.saldo || 0;
            let porcentajeLudopatia = 0;
            if (apostado > 0) { porcentajeLudopatia = ((apostado / (apostado + saldoActual)) * 100).toFixed(1); }

            let colorLudo = porcentajeLudopatia > 80 ? 'color: #ff4d4d;' : (porcentajeLudopatia > 50 ? 'color: #f39c12;' : 'color: #2ecc71;');

            html += `<tr>
                <td>${medalla}</td>
                <td>Jugador_${idCorto}</td>
                <td class="highlight-green">$${apostado.toFixed(2)}</td>
                <td style="font-weight:bold; ${colorLudo}">${porcentajeLudopatia}%</td>
            </tr>`;
        });
        html += '</table>';
        contenedor.innerHTML = html;
    } catch(e) { contenedor.innerHTML = '<p>Error al cargar el ranking.</p>'; }
}

async function cargarHistorialDesdeBD() {
    apuestasUsuario = [];
    const contenedor = document.getElementById('history-items');
    contenedor.innerHTML = '<p class="empty-msg">Cargando...</p>';
    
    const { data, error } = await supabaseClient.from('historial_apuestas')
        .select('*')
        .eq('user_id', currentUserId)
        .order('id', { ascending: true }); 

    if (data) { 
        apuestasUsuario = data.map(apuesta => {
            if (typeof apuesta.selecciones === 'string') {
                try { apuesta.selecciones = JSON.parse(apuesta.selecciones); } catch(e) {}
            }
            return apuesta;
        });
    }

    if (equiposGlobales.length === 0) {
        const { data: equipos } = await supabaseClient.from('equipos').select('*');
        if (equipos) equiposGlobales = equipos;
        const { data: jug } = await supabaseClient.from('jugadores').select('*');
        if (jug) jugadoresGlobales = jug;
    }

    resolverApuestasOffline(); 
    renderizarHistorial();
}

async function guardarApuestaBD(apuestaTemp) {
    apuestaTemp.id = Date.now(); 
    apuestasUsuario.push(apuestaTemp);
    renderizarHistorial();

    const { data, error } = await supabaseClient.from('historial_apuestas')
        .insert([{
            user_id: currentUserId,
            tipoBoleta: apuestaTemp.tipoBoleta,
            selecciones: apuestaTemp.selecciones,
            monto: apuestaTemp.monto,
            cuotaTotal: apuestaTemp.cuotaTotal,
            gananciaPosible: apuestaTemp.gananciaPosible,
            estado: apuestaTemp.estado,
            resuelta: apuestaTemp.resuelta
        }]).select().single();

    if (data) {
        const index = apuestasUsuario.findIndex(a => a.id === apuestaTemp.id);
        if(index !== -1) { 
            if (typeof data.selecciones === 'string') {
                try { data.selecciones = JSON.parse(data.selecciones); } catch(e) {}
            }
            apuestasUsuario[index] = data; 
        }
    }
}

async function actualizarApuestaBD(apuestaDbId, estado, resuelta) {
    await supabaseClient.from('historial_apuestas')
        .update({ estado: estado, resuelta: resuelta })
        .eq('id', apuestaDbId);
}

window.borrarHistorialBD = async function() {
    if(!confirm("¿Estás seguro de borrar todo tu historial de apuestas?")) return;
    document.getElementById('history-items').innerHTML = '<p class="empty-msg">Borrando...</p>';
    await supabaseClient.from('historial_apuestas').delete().eq('user_id', currentUserId);
    apuestasUsuario = [];
    renderizarHistorial();
}

// =========================================================================
// SISTEMA AUTOMATIZADO MULTI-RELOJ Y GENERADORES POR DEPORTE
// =========================================================================

async function inicializarDeportes() {
    if (equiposGlobales.length === 0) {
        const contenedor = document.getElementById('contenedor-partidos');
        contenedor.innerHTML = '<p>Buscando ligas, competidores y estadísticas en la base de datos...</p>';
        try {
            const { data: equipos, error } = await supabaseClient.from('equipos').select('*');
            if (error) throw error;
            if (!equipos || equipos.length < 2) return;
            equiposGlobales = equipos;

            actualizarLigasPorDeporte();

            try {
                const { data: jug, error: errJug } = await supabaseClient.from('jugadores').select('*');
                if (!errJug && jug) jugadoresGlobales = jug;
            } catch(e) { console.log("Tabla jugadores aún no está lista."); }

        } catch (error) { contenedor.innerHTML = '<p style="color:#ff4d4d;">Error de base de datos.</p>'; return; }
    } else {
        actualizarLigasPorDeporte();
    }
    
    if (!timerInterval) {
        globalRoundId = -1;
        cicloDeportes(); 
        timerInterval = setInterval(cicloDeportes, 1000);
    }
    renderizarHistorial();
}

function detenerDeportes() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

window.cambiarDeporte = function(nuevoDeporte) {
    deporteActual = nuevoDeporte;
    localStorage.setItem('deporteActual', nuevoDeporte);
    document.querySelectorAll('.btn-sport').forEach(btn => btn.classList.remove('active'));
    
    const btnActivar = document.getElementById('btn-sport-' + nuevoDeporte.toLowerCase());
    if(btnActivar) btnActivar.classList.add('active');
    
    actualizarLigasPorDeporte();
    cicloDeportes();
    renderizarPartidos();
}

function actualizarLigasPorDeporte() {
    let equiposDelDeporte = equiposGlobales.filter(e => (e.deporte || 'Futbol') === deporteActual);
    ligasDisponibles = [...new Set(equiposDelDeporte.map(e => e.liga || 'General'))];
    
    let savedLiga = localStorage.getItem('ligaActual');
    if (savedLiga && ligasDisponibles.includes(savedLiga)) {
        ligaActual = savedLiga;
    } else if (!ligasDisponibles.includes(ligaActual) && ligasDisponibles.length > 0) {
        ligaActual = ligasDisponibles[0];
    } else if (ligasDisponibles.length === 0) {
        ligaActual = '';
    }
    
    renderizarSelectorLigas();
}

function renderizarSelectorLigas() {
    const contenedor = document.getElementById('league-selector');
    contenedor.innerHTML = '';
    if (ligasDisponibles.length === 0) return;
    
    ligasDisponibles.forEach(liga => {
        const btn = document.createElement('button');
        btn.className = `btn-league ${liga === ligaActual ? 'active' : ''}`;
        btn.innerText = liga;
        btn.onclick = () => cambiarLiga(liga);
        contenedor.appendChild(btn);
    });
}

function cambiarLiga(nuevaLiga) {
    ligaActual = nuevaLiga;
    localStorage.setItem('ligaActual', nuevaLiga); 
    renderizarSelectorLigas();
    renderizarPartidos();
}

function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function mezclarArrayDeterminista(array, seed) {
    let arr = [...array];
    let currentSeed = seed;
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(currentSeed++) * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function seleccionarGoleador(equipo, seedObj, esGol = false) {
    let jugadoresEquipo = jugadoresGlobales.filter(j => 
        j.equipo_id == equipo.id || 
        j.id_equipo == equipo.id || 
        j.equipo == equipo.nombre || 
        j.equipo_nombre == equipo.nombre ||
        (j.equipo_id && String(j.equipo_id).toLowerCase() === String(equipo.nombre).toLowerCase())
    );
    
    if (jugadoresEquipo.length === 0) return "Jugador de " + equipo.nombre;

    let pool = jugadoresEquipo; 

    if (esGol) {
        let usanPorcentaje = pool.some(j => j.porcentaje_gol !== undefined || j.prob_gol !== undefined || j.probabilidad !== undefined);
        
        if (usanPorcentaje) {
            let probTotal = 0;
            pool.forEach(j => {
                let val = parseFloat(j.porcentaje_gol || j.prob_gol || j.probabilidad || 1);
                j._tempProb = isNaN(val) ? 1 : val;
                probTotal += j._tempProb;
            });
            
            let r = seededRandom(seedObj.val++) * probTotal;
            let acumulado = 0;
            for (let j of pool) {
                acumulado += j._tempProb;
                if (r <= acumulado) return j.nombre;
            }
        } else {
            let ofensivos = pool.filter(j => {
                let pos = String(j.posicion || j.rol || j.tipo || j.calificacion || "").toLowerCase();
                return pos.includes('delantero') || pos.includes('medio') || pos.includes('atacante');
            });
            if (ofensivos.length > 0 && seededRandom(seedObj.val++) < 0.85) {
                pool = ofensivos;
            }
        }
    }

    let rSeleccion = seededRandom(seedObj.val++);
    let seleccionado = pool[Math.floor(rSeleccion * pool.length)];
    return seleccionado ? seleccionado.nombre : ("Jugador de " + equipo.nombre);
}

function calcularCuotasBase(local, visitante) {
    let fuerzaL = (local.estadistica_ataque || 10) + (local.estadistica_defensa || 10);
    let fuerzaV = (visitante.estadistica_ataque || 10) + (visitante.estadistica_defensa || 10);
    let total = fuerzaL + fuerzaV;
    let probL = (fuerzaL / total) * 0.95; 
    let probV = (fuerzaV / total) * 0.95;
    return { probL, probV };
}

function precalcularFutbol(partido, seedObj) {
    let { probL, probV } = calcularCuotasBase(partido.local, partido.visitante);
    let probE = 1 - (probL * 0.75 + probV * 0.75);
    
    partido.cuotas = {
        L: (1 / (probL * 0.75 * 1.15)).toFixed(2), E: (1 / (probE * 1.15)).toFixed(2), V: (1 / (probV * 0.75 * 1.15)).toFixed(2),
        LE: (1 / ((probL*0.75 + probE) * 1.15)).toFixed(2), VE: (1 / ((probV*0.75 + probE) * 1.15)).toFixed(2),
        Mas25: (1.85).toFixed(2), Menos25: (1.95).toFixed(2)
    };

    partido.tiempoExtra = Math.floor(seededRandom(seedObj.val++) * 5) + 1; 
    let maxMinutos = 90 + partido.tiempoExtra;

    partido.golesFinalesL = seededRandom(seedObj.val++) < probL ? Math.floor(seededRandom(seedObj.val++) * 3) + 1 : 0;
    partido.golesFinalesV = seededRandom(seedObj.val++) < probV ? Math.floor(seededRandom(seedObj.val++) * 3) + 1 : 0;

    partido.eventos = [];
    
    for(let i=0; i<partido.golesFinalesL; i++) {
        let minutoGol = Math.floor(seededRandom(seedObj.val++) * maxMinutos) + 1;
        let jugador = seleccionarGoleador(partido.local, seedObj, true); 
        
        let minutoAtaque = Math.max(1, minutoGol - 1);
        if (!partido.eventos.some(e => e.minuto === minutoAtaque)) {
            partido.eventos.push({ equipo: 'L', tipo: 'ATAQUE', minuto: minutoAtaque, jugador: jugador, texto: `¡ATAQUE PELIGROSO!`, x: 75, y: 50, procesado: false });
        }
        partido.eventos.push({ equipo: 'L', tipo: 'GOL', minuto: minutoGol, jugador: jugador, texto: `¡GOL!`, x: 92, y: 50, procesado: false });

        let minutoSaque = Math.min(maxMinutos, minutoGol + 1);
        if (!partido.eventos.some(e => e.minuto === minutoSaque)) {
            partido.eventos.push({ equipo: 'V', tipo: 'POSESION', minuto: minutoSaque, jugador: '', texto: 'Saca del medio', x: 50, y: 50, procesado: false });
        }
    }

    for(let i=0; i<partido.golesFinalesV; i++) {
        let minutoGol = Math.floor(seededRandom(seedObj.val++) * maxMinutos) + 1;
        let jugador = seleccionarGoleador(partido.visitante, seedObj, true); 
        
        let minutoAtaque = Math.max(1, minutoGol - 1);
        if (!partido.eventos.some(e => e.minuto === minutoAtaque)) {
            partido.eventos.push({ equipo: 'V', tipo: 'ATAQUE', minuto: minutoAtaque, jugador: jugador, texto: `¡ATAQUE PELIGROSO!`, x: 25, y: 50, procesado: false });
        }
        partido.eventos.push({ equipo: 'V', tipo: 'GOL', minuto: minutoGol, jugador: jugador, texto: `¡GOL!`, x: 8, y: 50, procesado: false });

        let minutoSaque = Math.min(maxMinutos, minutoGol + 1);
        if (!partido.eventos.some(e => e.minuto === minutoSaque)) {
            partido.eventos.push({ equipo: 'L', tipo: 'POSESION', minuto: minutoSaque, jugador: '', texto: 'Saca del medio', x: 50, y: 50, procesado: false });
        }
    }

    let numNarrativas = Math.floor(seededRandom(seedObj.val++) * 20) + 20; 
    for(let i=0; i<numNarrativas; i++) {
        let eq = seededRandom(seedObj.val++) < 0.5 ? 'L' : 'V';
        let equipoActivo = eq === 'L' ? partido.local : partido.visitante; 
        let jugadorAccion = seleccionarGoleador(equipoActivo, seedObj, false); 
        
        let tipoRandom = seededRandom(seedObj.val++);
        let tipoEv = 'JUGADA';
        let txt = '';
        let posX = 50;
        let posY = Math.floor(seededRandom(seedObj.val++) * 80) + 10;
        
        if (tipoRandom < 0.20) {
            txt = `Pelota dividida`; posX = Math.floor(seededRandom(seedObj.val++) * 40) + 30; tipoEv = 'POSESION';
        } else if (tipoRandom < 0.45) {
            txt = `Arma la jugada`; posX = eq === 'L' ? 40 : 60; tipoEv = 'POSESION';
        } else if (tipoRandom < 0.70) {
            txt = `¡Se acerca al área!`; posX = eq === 'L' ? 70 : 30; tipoEv = 'ATAQUE';
        } else if (tipoRandom < 0.85) {
            txt = `Despeje largo`; posX = eq === 'L' ? 80 : 20; posY = 50; tipoEv = 'JUGADA';
        } else {
            txt = `Falta en el mediocampo`; posX = Math.floor(seededRandom(seedObj.val++) * 40) + 30; tipoEv = 'FALTA';
        }

        let rndMin = Math.floor(seededRandom(seedObj.val++) * maxMinutos) + 1;
        if (!partido.eventos.some(e => e.minuto === rndMin)) {
            partido.eventos.push({ equipo: eq, tipo: tipoEv, texto: txt, minuto: rndMin, jugador: jugadorAccion, x: posX, y: posY, procesado: false });
        }
    }
    partido.eventos.sort((a,b) => a.minuto - b.minuto);
}

function precalcularBasketball(partido, seedObj) {
    let { probL, probV } = calcularCuotasBase(partido.local, partido.visitante);
    
    partido.cuotas = {
        L: (1 / (probL * 1.10)).toFixed(2),
        V: (1 / (probV * 1.10)).toFixed(2)
    };

    partido.tiempoExtra = 0;
    partido.eventos = [];
    let ptsL = 0; let ptsV = 0;

    for(let m=1; m<=48; m++) {
        let posesionesL = Math.floor(seededRandom(seedObj.val++) * 3) + 1; 
        for(let p=0; p<posesionesL; p++) {
            if(seededRandom(seedObj.val++) < probL + 0.05) { 
                let r = seededRandom(seedObj.val++);
                let totalPts = r < 0.20 ? 1 : (r < 0.65 ? 2 : 3);
                ptsL += totalPts;
                partido.eventos.push({ equipo: 'L', minuto: m, pts: totalPts, jugador: seleccionarGoleador(partido.local, seedObj, true), procesado: false }); 
            }
        }
        
        let posesionesV = Math.floor(seededRandom(seedObj.val++) * 3) + 1;
        for(let p=0; p<posesionesV; p++) {
            if(seededRandom(seedObj.val++) < probV + 0.05) {
                let r = seededRandom(seedObj.val++);
                let totalPts = r < 0.20 ? 1 : (r < 0.65 ? 2 : 3);
                ptsV += totalPts;
                partido.eventos.push({ equipo: 'V', minuto: m, pts: totalPts, jugador: seleccionarGoleador(partido.visitante, seedObj, true), procesado: false });
            }
        }
    }
    
    if (ptsL === ptsV) ptsL += 2;

    partido.golesFinalesL = ptsL;
    partido.golesFinalesV = ptsV;
    partido.resultado = { dif: ptsL - ptsV, total: ptsL + ptsV };
}

function precalcularUFC(partido, seedObj) {
    let { probL, probV } = calcularCuotasBase(partido.local, partido.visitante);
    
    partido.cuotas = {
        L: (1 / (probL * 1.10)).toFixed(2),
        V: (1 / (probV * 1.10)).toFixed(2)
    };

    partido.tiempoExtra = 0;
    partido.eventos = [];

    let winR = seededRandom(seedObj.val++);
    let winner = winR < probL ? 'L' : 'V';
    
    let methodR = seededRandom(seedObj.val++);
    let method = methodR < 0.4 ? 'KO' : (methodR < 0.65 ? 'SUB' : 'DEC');

    let endMinute = method !== 'DEC' ? Math.floor(seededRandom(seedObj.val++) * 24) + 1 : 25;

    const ufcComments = [
        "conecta un gran upper",
        "hace tambalear a su oponente",
        "intenta una patada giratoria",
        "consigue un derribo espectacular",
        "suelta un jab rápido",
        "lanza una ráfaga de golpes",
        "busca una llave de sumisión",
        "conecta un rodillazo al cuerpo"
    ];

    for(let m=1; m<endMinute; m++) {
        if(seededRandom(seedObj.val++) < 0.35) {
            let eq = seededRandom(seedObj.val++) < 0.5 ? 'L' : 'V';
            let accion = ufcComments[Math.floor(seededRandom(seedObj.val++) * ufcComments.length)];
            partido.eventos.push({ equipo: eq, minuto: m, tipo: accion, procesado: false });
        }
    }

    let winText = method === 'KO' ? 'Nocaut (KO)' : (method === 'SUB' ? 'Sumisión' : 'Decisión');
    partido.eventos.push({ equipo: winner, minuto: endMinute, tipo: `¡GANA POR ${winText.toUpperCase()}!`, procesado: false, final: true });

    partido.resultado = { ganador: winner, metodo: method };
    partido.golesFinalesL = winner === 'L' ? 1 : 0; 
    partido.golesFinalesV = winner === 'V' ? 1 : 0;
}

function precalcularTenis(partido, seedObj) {
    let { probL, probV } = calcularCuotasBase(partido.local, partido.visitante);
    
    partido.cuotas = {
        L: (1 / (probL * 1.10)).toFixed(2),
        V: (1 / (probV * 1.10)).toFixed(2),
        L30: 4.50,
        V30: 4.50,
        Mas35: 1.85,
        Menos35: 1.85
    };

    partido.tiempoExtra = 0;
    partido.eventos = [];

    let setsL = 0; let setsV = 0;
    let totalGames = 0;
    let serverL = seededRandom(seedObj.val++) < 0.5; 
    let gameEventsTemp = [];

    while (setsL < 3 && setsV < 3) {
        let gamesL = 0;
        let gamesV = 0;

        while (true) {
            let probLWinGame = serverL ? probL + 0.15 : probL - 0.15;
            probLWinGame = Math.max(0.15, Math.min(0.85, probLWinGame));
            
            let winL = seededRandom(seedObj.val++) < probLWinGame;
            if (winL) gamesL++; else gamesV++;
            totalGames++;
            
            serverL = !serverL; 

            if ((gamesL >= 6 && gamesL - gamesV >= 2) || (gamesV >= 6 && gamesV - gamesL >= 2) || gamesL === 7 || gamesV === 7) {
                if (gamesL > gamesV) setsL++; else setsV++;
                gameEventsTemp.push({ 
                    equipo: gamesL > gamesV ? 'L' : 'V', 
                    text: `¡Set ${setsL+setsV} para ${gamesL > gamesV ? partido.local.nombre : partido.visitante.nombre}! (${setsL}-${setsV})`,
                    isSetWin: true,
                    curSetsL: setsL,
                    curSetsV: setsV
                });
                break; 
            } else {
                gameEventsTemp.push({ 
                    equipo: winL ? 'L':'V', 
                    text: `Juego para ${winL ? partido.local.nombre : partido.visitante.nombre} (Games del Set: ${gamesL}-${gamesV})`,
                    isSetWin: false
                });
            }
        }
    }

    partido.resultado = { setsL, setsV, totalGames };
    
    let interval = configDeportes.Tenis.playTime / gameEventsTemp.length;
    let currTime = 0;

    for(let i=0; i<gameEventsTemp.length; i++) {
        currTime += interval;
        let m = Math.floor(currTime);
        if(m > configDeportes.Tenis.playTime) m = configDeportes.Tenis.playTime;
        if(m < 1) m = 1;
        
        partido.eventos.push({
            equipo: gameEventsTemp[i].equipo,
            minuto: m,
            text: gameEventsTemp[i].text,
            isSetWin: gameEventsTemp[i].isSetWin,
            curSetsL: gameEventsTemp[i].curSetsL,
            curSetsV: gameEventsTemp[i].curSetsV,
            procesado: false
        });
    }

    partido.eventos.push({ equipo: 'E', minuto: configDeportes.Tenis.playTime, text: `FINAL: ${setsL} Sets a ${setsV}`, procesado: false, final: true });
    
    partido.golesFinalesL = setsL;
    partido.golesFinalesV = setsV;
}

function iniciarRondaSincronizadaPorDeporte(deporte, roundId) {
    let conf = configDeportes[deporte];
    let seedObj = { val: (roundId * 1000) + deporte.length };

    partidosActuales = partidosActuales.filter(p => p.deporte !== deporte);
    
    let equiposDelDeporte = equiposGlobales.filter(e => (e.deporte || 'Futbol') === deporte);
    if(equiposDelDeporte.length < 2) return;

    let equiposPorLiga = {};
    equiposDelDeporte.forEach(eq => {
        let l = eq.liga || 'General';
        if(!equiposPorLiga[l]) equiposPorLiga[l] = [];
        equiposPorLiga[l].push(eq);
    });

    for (let liga in equiposPorLiga) {
        let mezclados = mezclarArrayDeterminista(equiposPorLiga[liga], seedObj.val++);
        for (let i = 0; i < mezclados.length - 1; i += 2) {
            let local = mezclados[i];
            let visitante = mezclados[i+1];
            
            let nuevoPartido = {
                id: `match_${local.id}_${visitante.id}_${deporte}_${roundId}`,
                deporte: deporte,
                liga: liga,
                local, visitante, 
                golesL: 0, golesV: 0, finalizado: false, finalizadoGlobal: false,
                eventos: [], eventosUI: []
            };

            if (deporte === 'Futbol') precalcularFutbol(nuevoPartido, seedObj);
            else if (deporte === 'Basketball') precalcularBasketball(nuevoPartido, seedObj);
            else if (deporte === 'UFC') precalcularUFC(nuevoPartido, seedObj);
            else if (deporte === 'Tenis') precalcularTenis(nuevoPartido, seedObj);

            partidosActuales.push(nuevoPartido);
        }
    }
    
    if (deporte === deporteActual) renderizarPartidos();
}

function cicloDeportes() {
    const now = Math.floor(Date.now() / 1000); 
    
    let roundId = Math.floor(now / globalCycleLength);
    let secActuales = now % globalCycleLength;
    
    faseApuestasAbierta = secActuales < globalBetTime;
    let tiempoFase = faseApuestasAbierta ? (globalBetTime - secActuales) : (globalCycleLength - secActuales);

    const timerDisplay = document.getElementById('sports-timer');
    const statusDisplay = document.getElementById('sports-status');

    if (globalRoundId !== roundId) {
        globalRoundId = roundId;
        for (let deporte in configDeportes) {
            iniciarRondaSincronizadaPorDeporte(deporte, roundId);
        }
    }

    if (faseApuestasAbierta) {
        timerDisplay.innerText = `${tiempoFase}s`;
        statusDisplay.innerHTML = "Fase de Apuestas - ¡Hagan sus juegos!";
        statusDisplay.style.color = "#2ecc71";
        habilitarBotonesApuesta();
    } else {
        deshabilitarBotonesApuesta();
        timerDisplay.innerText = `${tiempoFase}s`;
        statusDisplay.innerHTML = `<img src="imagen_copa.png" class="custom-emoji" alt="Copa"> Competiciones en Vivo (Nuevo ciclo de apuestas en ${tiempoFase}s)`;
        statusDisplay.style.color = "#e74c3c";
    }

    if (!faseApuestasAbierta && secActuales === globalBetTime) {
        ticketSelecciones = [];
        actualizarUIBotones(); 
        actualizarTicketUI(); 
    }

    if (!faseApuestasAbierta) {
        let tiempoJugadoGlobal = secActuales - globalBetTime + 1;

        for (let deporte in configDeportes) {
            let conf = configDeportes[deporte];
            let minutoASimular = Math.min(tiempoJugadoGlobal, conf.playTime);
            simularMinutoPartidoPorDeporte(deporte, minutoASimular);

            let partidosDelDeporte = partidosActuales.filter(p => p.deporte === deporte);
            if (tiempoJugadoGlobal >= conf.playTime && partidosDelDeporte.length > 0 && !partidosDelDeporte[0].finalizado) {
                finalizarPartidosPorDeporte(deporte);
                simularMinutoPartidoPorDeporte(deporte, conf.playTime); 
            }
        }
    }

    renderizarMisPartidosEnVivo();
}

window.toggleBets = function(partidoId) {
    const panel = document.getElementById(`bets-${partidoId}`);
    if(panel.classList.contains('hidden')) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
}

function generarHTMLBotonesApuesta(partido) {
    let h = `<div class="odds-grid">`;
    if (partido.deporte === 'Futbol') {
        h += `<button id="btn-${partido.id}-L" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'L', ${partido.cuotas.L}, '${partido.local.nombre}', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Local: ${partido.cuotas.L}</button>
              <button id="btn-${partido.id}-E" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'E', ${partido.cuotas.E}, 'Empate', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Empate: ${partido.cuotas.E}</button>
              <button id="btn-${partido.id}-V" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'V', ${partido.cuotas.V}, '${partido.visitante.nombre}', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Visita: ${partido.cuotas.V}</button>
              <button id="btn-${partido.id}-LE" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'LE', ${partido.cuotas.LE}, '1X', '${partido.local.nombre} vs ${partido.visitante.nombre}')">1X: ${partido.cuotas.LE}</button>
              <button id="btn-${partido.id}-VE" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'VE', ${partido.cuotas.VE}, 'X2', '${partido.local.nombre} vs ${partido.visitante.nombre}')">X2: ${partido.cuotas.VE}</button>
              <button id="btn-${partido.id}-Mas25" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'Mas25', ${partido.cuotas.Mas25}, '+2.5 Goles', '${partido.local.nombre} vs ${partido.visitante.nombre}')">+2.5 Goles: ${partido.cuotas.Mas25}</button>
              <button id="btn-${partido.id}-Menos25" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'Menos25', ${partido.cuotas.Menos25}, '-2.5 Goles', '${partido.local.nombre} vs ${partido.visitante.nombre}')">-2.5 Goles: ${partido.cuotas.Menos25}</button>`;
    }
    else if (partido.deporte === 'Basketball') {
         h += `<button id="btn-${partido.id}-L" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'L', ${partido.cuotas.L}, '${partido.local.nombre}', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Gana L: ${partido.cuotas.L}</button>
              <button id="btn-${partido.id}-V" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'V', ${partido.cuotas.V}, '${partido.visitante.nombre}', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Gana V: ${partido.cuotas.V}</button>
              <button id="btn-${partido.id}-HandicapL" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'HandicapL', 1.85, 'Hándicap L -5.5', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Handicap L (-5.5): 1.85</button>
              <button id="btn-${partido.id}-HandicapV" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'HandicapV', 1.85, 'Hándicap V +5.5', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Handicap V (+5.5): 1.85</button>
              <button id="btn-${partido.id}-Mas215" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'Mas215', 1.90, '+215.5 Pts', '${partido.local.nombre} vs ${partido.visitante.nombre}')">+215.5 Pts: 1.90</button>
              <button id="btn-${partido.id}-Menos215" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'Menos215', 1.90, '-215.5 Pts', '${partido.local.nombre} vs ${partido.visitante.nombre}')">-215.5 Pts: 1.90</button>`;
    }
    else if (partido.deporte === 'UFC') {
         h += `<button id="btn-${partido.id}-L" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'L', ${partido.cuotas.L}, '${partido.local.nombre}', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Gana Local: ${partido.cuotas.L}</button>
              <button id="btn-${partido.id}-V" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'V', ${partido.cuotas.V}, '${partido.visitante.nombre}', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Gana Visita: ${partido.cuotas.V}</button>
              <button id="btn-${partido.id}-KO" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'KO', 2.50, 'Por KO', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Por KO/TKO: 2.50</button>
              <button id="btn-${partido.id}-SUB" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'SUB', 3.80, 'Por Sumisión', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Por Sumisión: 3.80</button>
              <button id="btn-${partido.id}-DEC" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'DEC', 2.10, 'Por Decisión', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Por Decisión: 2.10</button>`;
    }
    else if (partido.deporte === 'Tenis') {
        h += `<button id="btn-${partido.id}-L" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'L', ${partido.cuotas.L}, '${partido.local.nombre}', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Gana Local: ${partido.cuotas.L}</button>
              <button id="btn-${partido.id}-V" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'V', ${partido.cuotas.V}, '${partido.visitante.nombre}', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Gana Visita: ${partido.cuotas.V}</button>
              <button id="btn-${partido.id}-L30" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'L30', ${partido.cuotas.L30}, 'Local 3-0 Sets', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Local 3-0: ${partido.cuotas.L30}</button>
              <button id="btn-${partido.id}-V30" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'V30', ${partido.cuotas.V30}, 'Visita 3-0 Sets', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Visita 3-0: ${partido.cuotas.V30}</button>
              <button id="btn-${partido.id}-Mas35" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'Mas35', ${partido.cuotas.Mas35}, '+35.5 Juegos', '${partido.local.nombre} vs ${partido.visitante.nombre}')">+35.5 Juegos: ${partido.cuotas.Mas35}</button>
              <button id="btn-${partido.id}-Menos35" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'Menos35', ${partido.cuotas.Menos35}, '-35.5 Juegos', '${partido.local.nombre} vs ${partido.visitante.nombre}')">-35.5 Juegos: ${partido.cuotas.Menos35}</button>`;
    }
    h += `</div>`;
    return h;
}

function renderizarPartidos() {
    const contenedor = document.getElementById('contenedor-partidos');
    contenedor.innerHTML = ''; 

    let partidosParaMostrar = partidosActuales.filter(p => p.deporte === deporteActual && p.liga === ligaActual);

    if(partidosParaMostrar.length === 0) {
        contenedor.innerHTML = '<p>No hay eventos generados para esta liga en este deporte.</p>';
        return;
    }

    partidosParaMostrar.forEach(partido => {
        let centerSymbol = " : ";
        let resText = `${partido.golesL}${centerSymbol}${partido.golesV}`;
        let resStyle = "";
        
        if(partido.deporte === 'UFC') {
            resStyle = "font-size: 16px;";
            if(partido.finalizadoGlobal || partido.finalizado) {
                resText = `Ganador: ${partido.resultado.ganador === 'L' ? partido.local.nombre : partido.visitante.nombre}`;
            } else {
                resText = `<img src="imagen_ufc.png" class="custom-emoji" alt="UFC"> EN PELEA`;
            }
        }

        const matchCard = document.createElement('div');
        matchCard.className = 'match-card';
        
        let canchaHTML = '';
        if (partido.deporte === 'Futbol') {
            canchaHTML = `
                <div class="cancha-realista" id="cancha-container-${partido.id}">
                    <div class="cancha-lineas">
                        <div class="linea-central"></div>
                        <div class="circulo-central"></div>
                        <div class="area-local"></div>
                        <div class="area-visitante"></div>
                        
                        <div id="puntito-tracker-${partido.id}" class="puntito-tracker">
                            <span id="player-name-${partido.id}" class="player-name-floating"></span>
                        </div>
                    </div>
                    <div id="texto-cancha-${partido.id}" class="texto-cancha-flotante">Comienza el partido</div>
                </div>
            `;
        }

        matchCard.innerHTML = `
            <div class="match-header">
                <div class="team-info">
                    ${partido.local.imagen ? `<img src="${partido.local.imagen}" class="team-logo" alt="${partido.local.nombre}">` : ''}
                    <h3>${partido.local.nombre}</h3>
                    <span class="team-stats">ATK: ${partido.local.estadistica_ataque} | DEF: ${partido.local.estadistica_defensa}</span>
                </div>
                <div class="match-center">
                    <div id="timer-${partido.id}" class="match-individual-timer">${partido.finalizadoGlobal || partido.finalizado ? 'FINAL' : "0'"}</div>
                    <div id="res-${partido.id}" class="result-display" style="${resStyle}">${resText}</div>
                </div>
                <div class="team-info">
                    ${partido.visitante.imagen ? `<img src="${partido.visitante.imagen}" class="team-logo" alt="${partido.visitante.nombre}">` : ''}
                    <h3>${partido.visitante.nombre}</h3>
                    <span class="team-stats">ATK: ${partido.visitante.estadistica_ataque} | DEF: ${partido.visitante.estadistica_defensa}</span>
                </div>
            </div>
            
            <button class="btn-toggle-cancha" onclick="toggleCancha('${partido.id}')"><img src="tele.png" class="custom-emoji" alt="TV"> Ver Partido Animado / Relatos</button>
            <div id="cancha-wrapper-${partido.id}" class="hidden">
                
                ${canchaHTML}
                
                <div id="estado-partido-${partido.id}" class="estado-inferior">Preparando equipos...</div>

                <div class="match-events-container" id="events-${partido.id}">
                    ${partido.eventosUI.map(e => `<div>${e}</div>`).join('')}
                </div>
            </div>

            <button class="btn-toggle-bets" onclick="toggleBets('${partido.id}')">Opciones de Apuesta ▼</button>

            <div id="bets-${partido.id}" class="betting-panel hidden">
                ${generarHTMLBotonesApuesta(partido)}
            </div>
        `;
        contenedor.appendChild(matchCard);
    });

    if (!faseApuestasAbierta) deshabilitarBotonesApuesta();
    actualizarUIBotones();
}

function simularMinutoPartidoPorDeporte(deporte, minutoReal) {
    partidosActuales.filter(p => p.deporte === deporte).forEach(partido => {
        
        let huboEvento = false;
        if (!partido.finalizado) {
            partido.eventos.forEach(ev => {
                if (ev.minuto <= minutoReal && !ev.procesado) {
                    ev.procesado = true;
                    huboEvento = true;
                    
                    if(deporte === 'Futbol') {
                        let minText = ev.minuto > 90 ? `90+${ev.minuto-90}'` : `${ev.minuto}'`;
                        
                        if (ev.tipo === 'GOL') {
                            if (ev.equipo === 'L') partido.golesL++; else partido.golesV++;
                            partido.eventosUI.unshift(`<img src="imagen_cronometro.png" class="custom-emoji" alt="Tiempo"> <b>${minText}</b> - <img src="imagen_futbol.png" class="custom-emoji" alt="Futbol"> ${ev.texto}`);
                        } else {
                            partido.eventosUI.unshift(`<img src="imagen_cronometro.png" class="custom-emoji" alt="Tiempo"> <b>${minText}</b> - <img src="imagen_correr.png" class="custom-emoji" alt="Correr"> ${ev.texto}`);
                        }

                        actualizarCancha2D(partido.id, ev.x, ev.y, ev.texto, ev.tipo, ev.jugador, ev.equipo, partido.local.nombre, partido.visitante.nombre);
                    } 
                    else if (deporte === 'Basketball') {
                        if (ev.equipo === 'L') partido.golesL += ev.pts; else partido.golesV += ev.pts;
                        let nEq = ev.equipo === 'L' ? partido.local.nombre : partido.visitante.nombre;
                        let ptStr = ev.pts === 1 ? 'Tiro Libre (1 pt)' : (ev.pts === 2 ? '2 pts (Dentro del área/Bandeja)' : 'Triple fuera del área (3 pts)');
                        partido.eventosUI.unshift(`<img src="imagen_cronometro.png" class="custom-emoji" alt="Tiempo"> <b>Q${Math.ceil(ev.minuto/12)} - ${ev.minuto}s</b> - <img src="imagen_basquet.png" class="custom-emoji" alt="Basket"> ${ptStr} de ${nEq} (<i>${ev.jugador}</i>)`);
                    }
                    else if (deporte === 'UFC') {
                        if(ev.final) {
                            partido.golesL = partido.resultado.ganador === 'L' ? 1 : 0;
                            partido.golesV = partido.resultado.ganador === 'V' ? 1 : 0;
                            partido.eventosUI.unshift(`<img src="imagen_cronometro.png" class="custom-emoji" alt="Tiempo"> <b>FINAL</b> - <img src="imagen_ufc.png" class="custom-emoji" alt="UFC"> ${ev.tipo}`);
                            partido.finalizadoGlobal = true; 
                        } else {
                            if (!partido.finalizadoGlobal) { 
                                let nEq = ev.equipo === 'L' ? partido.local.nombre : partido.visitante.nombre;
                                partido.eventosUI.unshift(`<img src="imagen_cronometro.png" class="custom-emoji" alt="Tiempo"> <b>${ev.minuto}s</b> - <img src="imagen_golpe.png" class="custom-emoji" alt="Golpe"> ${nEq} ${ev.tipo}`);
                            }
                        }
                    }
                    else if (deporte === 'Tenis') {
                        if(ev.final) {
                            partido.golesL = partido.resultado.setsL;
                            partido.golesV = partido.resultado.setsV;
                            partido.eventosUI.unshift(`<img src="imagen_cronometro.png" class="custom-emoji" alt="Tiempo"> <b>FINAL</b> - <img src="imagen_tenis.png" class="custom-emoji" alt="Tenis"> ${ev.text}`);
                            partido.finalizadoGlobal = true;
                        } else {
                            if (ev.isSetWin) {
                                partido.golesL = ev.curSetsL;
                                partido.golesV = ev.curSetsV;
                            }
                            partido.eventosUI.unshift(`<img src="imagen_cronometro.png" class="custom-emoji" alt="Tiempo"> <b>${ev.minuto}'</b> - <img src="imagen_tenis.png" class="custom-emoji" alt="Tenis"> ${ev.text}`);
                        }
                    }
                }
            });
        }

        let displayMinuto = "";
        let partidoTerminado = partido.finalizadoGlobal; 
        let conf = configDeportes[deporte];
        let playLimit = conf.playTime;

        if (deporte === 'Futbol') {
            playLimit = 90 + partido.tiempoExtra;
            if (minutoReal > 90 && minutoReal <= playLimit) {
                displayMinuto = `90+${minutoReal - 90}'`;
            } else if (minutoReal <= 90) {
                displayMinuto = `${minutoReal}'`;
            } else {
                displayMinuto = "FINAL";
                partidoTerminado = true;
                partido.finalizadoGlobal = true;
            }
        } else {
            displayMinuto = `${minutoReal}'`;
            if (minutoReal >= playLimit || partido.finalizadoGlobal) {
                displayMinuto = "FINAL";
                partidoTerminado = true;
                partido.finalizadoGlobal = true; 
            }
        }

        const isVisible = (deporte === deporteActual);
        if (isVisible) {
            const timerDisplay = document.getElementById(`timer-${partido.id}`);
            if (timerDisplay) {
                timerDisplay.innerText = displayMinuto;
                if (partidoTerminado) timerDisplay.style.color = "#ff4d4d";
                else timerDisplay.style.color = "#f185ff";
            }
        }

        if ((huboEvento || minutoReal === 1 || partidoTerminado) && isVisible) { 
            const resDisplay = document.getElementById(`res-${partido.id}`);
            if(resDisplay) {
                if (deporte === 'UFC') {
                    if (partidoTerminado || partido.finalizadoGlobal || partido.finalizado) {
                        resDisplay.innerText = `Ganador: ${partido.resultado.ganador === 'L' ? partido.local.nombre : partido.visitante.nombre}`;
                        resDisplay.style.fontSize = "16px";
                    } else {
                        resDisplay.innerHTML = `<img src="imagen_ufc.png" class="custom-emoji" alt="UFC"> EN PELEA`;
                        resDisplay.style.fontSize = "16px";
                    }
                } else {
                    let centerSymbol = " : ";
                    resDisplay.innerText = `${partido.golesL}${centerSymbol}${partido.golesV}`;
                }
            }
            
            const eventsDisplay = document.getElementById(`events-${partido.id}`);
            if(eventsDisplay) eventsDisplay.innerHTML = partido.eventosUI.map(e => `<div>${e}</div>`).join('');
        }
    });
}

function actualizarCancha2D(partidoId, xPercent, yPercent, texto, tipo, jugador, equipo, nombreLocal, nombreVisita) {
    const puntito = document.getElementById(`puntito-tracker-${partidoId}`);
    const textoCancha = document.getElementById(`texto-cancha-${partidoId}`);
    const playerName = document.getElementById(`player-name-${partidoId}`);
    const estadoInferior = document.getElementById(`estado-partido-${partidoId}`);
    const canchaContainer = document.getElementById(`cancha-container-${partidoId}`);
    
    if (!puntito || !textoCancha) return;

    let rx = Math.max(5, Math.min(95, xPercent));
    let ry = Math.max(10, Math.min(90, yPercent));

    puntito.style.left = `${rx}%`;
    puntito.style.top = `${ry}%`;

    if (playerName) playerName.innerText = jugador || '';
    if (canchaContainer) canchaContainer.classList.remove('animacion-gol');
    
    let equipoNombre = equipo === 'L' ? nombreLocal : nombreVisita;

    if (tipo === 'GOL') {
        puntito.style.backgroundColor = "#ff0000";
        puntito.style.boxShadow = "0 0 15px 5px rgba(255, 0, 0, 0.8)";
        if (estadoInferior) estadoInferior.innerHTML = `<span style="color:#ff4d4d">¡GOL DE ${equipoNombre.toUpperCase()}!</span>`;
        if (canchaContainer) canchaContainer.classList.add('animacion-gol');
    } else if (tipo === 'ATAQUE') {
        puntito.style.backgroundColor = "#ff7700";
        puntito.style.boxShadow = "0 0 15px 5px rgba(255, 119, 0, 0.8)";
        if (estadoInferior) estadoInferior.innerText = `Ataque Peligroso: ${equipoNombre}`;
    } else if (tipo === 'FALTA') {
        puntito.style.backgroundColor = "#fff";
        puntito.style.boxShadow = "0 0 10px 4px rgba(255, 255, 255, 0.6)";
        if (estadoInferior) estadoInferior.innerText = `Falta a favor de: ${equipoNombre}`;
    } else {
        puntito.style.backgroundColor = "#FFD700";
        puntito.style.boxShadow = "0 0 12px 4px rgba(255, 215, 0, 0.7)";
        if (estadoInferior) estadoInferior.innerText = `Posesión: ${equipoNombre}`;
    }

    textoCancha.innerText = texto;
}

function finalizarPartidosPorDeporte(deporte) {
    partidosActuales.filter(p => p.deporte === deporte).forEach(p => { 
        p.finalizado = true; 
        p.finalizadoGlobal = true; 
    });
    resolverApuestas();
}

function deshabilitarBotonesApuesta() {
    document.querySelectorAll('.btn-odd').forEach(el => {
        el.disabled = true; el.style.opacity = '0.5'; el.style.cursor = 'not-allowed';
    });
}

function habilitarBotonesApuesta() {
    document.querySelectorAll('.btn-odd').forEach(el => {
        el.disabled = false; el.style.opacity = '1'; el.style.cursor = 'pointer';
    });
}

window.toggleSeleccion = function(partidoId, tipo, cuota, labelDesc, partidoNombres) {
    let p = partidosActuales.find(x => x.id === partidoId);
    if (!p || !faseApuestasAbierta) return; 

    const indexIndex = ticketSelecciones.findIndex(s => s.partidoId === partidoId);
    
    if (indexIndex > -1) {
        if (ticketSelecciones[indexIndex].tipo === tipo) { ticketSelecciones.splice(indexIndex, 1); } 
        else { ticketSelecciones[indexIndex] = { partidoId, tipo, cuota, labelDesc, partidoNombres }; }
    } else { ticketSelecciones.push({ partidoId, tipo, cuota, labelDesc, partidoNombres }); }

    actualizarUIBotones(); actualizarTicketUI();
}

function actualizarUIBotones() {
    document.querySelectorAll('.btn-odd').forEach(btn => btn.classList.remove('selected'));
    ticketSelecciones.forEach(sel => {
        const btn = document.getElementById(`btn-${sel.partidoId}-${sel.tipo}`);
        if(btn) btn.classList.add('selected');
    });
}

window.toggleMobileTicket = function() {
    document.getElementById('bet-ticket').classList.toggle('show-mobile');
};
window.cerrarMobileTicket = function() {
    document.getElementById('bet-ticket').classList.remove('show-mobile');
};

function actualizarTicketUI() {
    const ticketPanel = document.getElementById('bet-ticket');
    const itemsContainer = document.getElementById('ticket-items');
    const floatingBtn = document.getElementById('btn-floating-ticket');
    const floatingCount = document.getElementById('floating-ticket-count');
    
    if (ticketSelecciones.length === 0) {
        ticketPanel.classList.add('hidden'); 
        if(floatingBtn) floatingBtn.classList.add('hidden');
        return;
    }

    ticketPanel.classList.remove('hidden');
    if(floatingBtn) {
        floatingBtn.classList.remove('hidden');
        if(floatingCount) floatingCount.innerText = ticketSelecciones.length;
    }

    itemsContainer.innerHTML = '';

    ticketSelecciones.forEach((sel, index) => {
        itemsContainer.innerHTML += `
            <div class="ticket-item">
                <div class="ticket-item-info">
                    <span class="ticket-match">${sel.partidoNombres}</span>
                    <span class="ticket-pick">${sel.labelDesc}</span>
                </div>
                <div class="ticket-item-odd">${sel.cuota.toFixed(2)}</div>
                <button class="btn-remove-item" onclick="removerDelTicket(${index})">X</button>
            </div>
        `;
    });

    const tipoLabel = ticketSelecciones.length === 1 ? 'Simple' : 'Combinada';
    document.getElementById('ticket-type').innerText = tipoLabel;

    let cuotaTotal = ticketSelecciones.reduce((acc, sel) => acc * sel.cuota, 1);
    document.getElementById('ticket-total-odds').innerText = cuotaTotal.toFixed(2);

    actualizarGanancia();
}

window.removerDelTicket = function(index) {
    ticketSelecciones.splice(index, 1);
    actualizarUIBotones(); actualizarTicketUI();
}

window.limpiarTicket = function() {
    ticketSelecciones = [];
    document.getElementById('ticket-amount').value = '';
    actualizarUIBotones(); actualizarTicketUI();
}

window.sumarMontoTicket = function(cantidad) {
    const input = document.getElementById('ticket-amount');
    let actual = parseFloat(input.value) || 0;
    input.value = actual + cantidad;
    actualizarGanancia();
}

window.actualizarGanancia = function() {
    const input = document.getElementById('ticket-amount');
    let monto = parseFloat(input.value) || 0;
    let cuotaTotal = ticketSelecciones.reduce((acc, sel) => acc * sel.cuota, 1);
    let ganancia = monto * cuotaTotal;
    document.getElementById('ticket-potential-win').innerText = `$${ganancia.toFixed(2)}`;
}

window.confirmarApuesta = function() {
    if (ticketSelecciones.length === 0) return;
    if (!faseApuestasAbierta) return; 
    for(let sel of ticketSelecciones) {
        let p = partidosActuales.find(x => x.id === sel.partidoId);
        if(!p) return; 
    }

    const input = document.getElementById('ticket-amount');
    const monto = parseFloat(input.value);
    
    if (isNaN(monto) || monto <= 0 || monto > currentSaldo) return; 

    actualizarSaldoBD(-monto);
    sumarTotalApostado(monto); 
    
    let cuotaTotal = ticketSelecciones.reduce((acc, sel) => acc * sel.cuota, 1);

    const nuevaApuesta = {
        tipoBoleta: ticketSelecciones.length === 1 ? 'Simple' : 'Combinada',
        selecciones: [...ticketSelecciones],
        monto: monto,
        cuotaTotal: cuotaTotal,
        gananciaPosible: monto * cuotaTotal,
        estado: 'pendiente',
        resuelta: false
    };

    guardarApuestaBD(nuevaApuesta);
    limpiarTicket();
    cerrarMobileTicket();
}

function renderizarHistorial() {
    const contenedor = document.getElementById('history-items');
    if (!apuestasUsuario || apuestasUsuario.length === 0) {
        contenedor.innerHTML = '<p class="empty-msg">No hay apuestas recientes.</p>'; 
        renderizarMisPartidosEnVivo();
        return;
    }
    contenedor.innerHTML = '';
    const historialReverso = [...apuestasUsuario].reverse();

    historialReverso.forEach(apuesta => {
        let estadoClass = ''; let estadoTexto = '';

        if (apuesta.estado === 'pendiente') { estadoClass = 'status-pending'; estadoTexto = 'Pendiente ⏳'; } 
        else if (apuesta.estado === 'ganada') { estadoClass = 'status-won'; estadoTexto = 'Ganada ✅'; } 
        else if (apuesta.estado === 'perdida') { estadoClass = 'status-lost'; estadoTexto = 'Perdida ❌'; } 
        else if (apuesta.estado === 'cancelada') { estadoClass = 'status-pending'; estadoTexto = 'Cancelada 🔄'; }

        let seleccionesHTML = '';
        if (apuesta.selecciones && Array.isArray(apuesta.selecciones)) {
            seleccionesHTML = apuesta.selecciones.map(sel => 
                `<div class="hist-sel-row"><span class="hist-match">${sel.partidoNombres}</span><span class="hist-pick">${sel.labelDesc} (${(sel.cuota || 0).toFixed(2)})</span></div>`
            ).join('');
        }

        contenedor.innerHTML += `
            <div class="history-item ${estadoClass}">
                <div class="hist-header"><span class="hist-type">${apuesta.tipoBoleta}</span><span class="hist-status">${estadoTexto}</span></div>
                <div class="hist-body">${seleccionesHTML}</div>
                <div class="hist-footer">
                    <span>Apostado: <b>$${(apuesta.monto || 0).toFixed(2)}</b></span>
                    <span>Retorno: <b>$${apuesta.estado === 'ganada' ? (apuesta.gananciaPosible || 0).toFixed(2) : (apuesta.estado === 'perdida' ? '0.00' : (apuesta.estado === 'pendiente' ? 'Pendiente' : (apuesta.gananciaPosible || 0).toFixed(2)))}</b></span>
                </div>
            </div>
        `;
    });
    
    renderizarMisPartidosEnVivo();
}

function verificarSeleccion(seleccion, partido) {
    if (partido.deporte === 'Futbol') {
        const gl = partido.golesFinalesL;
        const gv = partido.golesFinalesV;
        const totalGoles = gl + gv;
        switch (seleccion.tipo) {
            case 'L': return gl > gv;
            case 'E': return gl === gv;
            case 'V': return gl < gv;
            case 'LE': return gl >= gv;
            case 'VE': return gv >= gl;
            case 'Mas25': return totalGoles > 2.5;
            case 'Menos25': return totalGoles < 2.5;
        }
    } 
    else if (partido.deporte === 'Basketball') {
        const res = partido.resultado;
        switch (seleccion.tipo) {
            case 'L': return res.dif > 0;
            case 'V': return res.dif < 0;
            case 'HandicapL': return res.dif > -5.5; 
            case 'HandicapV': return res.dif < 5.5;
            case 'Mas215': return res.total > 215.5;
            case 'Menos215': return res.total < 215.5;
        }
    }
    else if (partido.deporte === 'UFC') {
        const res = partido.resultado;
        switch (seleccion.tipo) {
            case 'L': return res.ganador === 'L';
            case 'V': return res.ganador === 'V';
            case 'KO': return res.metodo === 'KO';
            case 'SUB': return res.metodo === 'SUB';
            case 'DEC': return res.metodo === 'DEC';
        }
    }
    else if (partido.deporte === 'Tenis') {
        const res = partido.resultado;
        switch (seleccion.tipo) {
            case 'L': return res.setsL > res.setsV;
            case 'V': return res.setsV > res.setsL;
            case 'L30': return res.setsL === 3 && res.setsV === 0;
            case 'V30': return res.setsL === 0 && res.setsV === 3;
            case 'Mas35': return res.totalGames > 35.5;
            case 'Menos35': return res.totalGames < 35.5;
        }
    }
    return false;
}

function resolverApuestas() {
    let gananciasRonda = 0;

    apuestasUsuario.forEach(apuesta => {
        if (apuesta.resuelta) return; 

        let todosFinalizados = true;
        let boletaGanadora = true;
        let partidoExtraviado = false;

        for (let sel of apuesta.selecciones) {
            const partidoReal = partidosActuales.find(p => p.id === sel.partidoId);
            
            if (partidoReal) {
                if (!partidoReal.finalizado) {
                    todosFinalizados = false; break;
                } else {
                    if (!verificarSeleccion(sel, partidoReal)) { boletaGanadora = false; }
                }
            } else {
                partidoExtraviado = true; 
            }
        }

        if (!todosFinalizados) return; 

        apuesta.resuelta = true; 

        if (partidoExtraviado) {
            apuesta.estado = 'cancelada';
            apuesta.gananciaPosible = apuesta.monto; 
            gananciasRonda += apuesta.monto;
        } else if (boletaGanadora) {
            apuesta.estado = 'ganada';
            gananciasRonda += apuesta.gananciaPosible; 
        } else {
            apuesta.estado = 'perdida';
        }
        
        if(apuesta.id) actualizarApuestaBD(apuesta.id, apuesta.estado, apuesta.resuelta);
    });

    if (gananciasRonda > 0) {
        actualizarSaldoBD(gananciasRonda);
    }
    
    renderizarHistorial();
}

async function resolverApuestasOffline() {
    if (!currentUserId || equiposGlobales.length === 0) return;
    const now = Math.floor(Date.now() / 1000);
    let currentGlobalRoundId = Math.floor(now / globalCycleLength);

    let actualizadas = false;
    let gananciasRecuperadas = 0;

    for (let apuesta of apuestasUsuario) {
        if (apuesta.estado === 'pendiente' && !apuesta.resuelta) {
            let todosFinalizados = true;
            let boletaGanadora = true;
            let partidoExtraviado = false;

            for (let sel of apuesta.selecciones) {
                let parts = sel.partidoId.split('_');
                if (parts.length >= 5) {
                    let localId = parts[1];
                    let visId = parts[2];
                    let deporte = parts[3];
                    let pRoundId = parseInt(parts[4]);

                    if (pRoundId < currentGlobalRoundId) {
                        let seedObj = { val: (pRoundId * 1000) + deporte.length };
                        let local = equiposGlobales.find(e => e.id == localId);
                        let visitante = equiposGlobales.find(e => e.id == visId);

                        if(local && visitante) {
                            let partidoFantasma = { local, visitante, deporte, eventos: [] };
                            if (deporte === 'Futbol') precalcularFutbol(partidoFantasma, seedObj);
                            else if (deporte === 'Basketball') precalcularBasketball(partidoFantasma, seedObj);
                            else if (deporte === 'UFC') precalcularUFC(partidoFantasma, seedObj);
                            else if (deporte === 'Tenis') precalcularTenis(partidoFantasma, seedObj);
                            
                            if (!verificarSeleccion(sel, partidoFantasma)) {
                                boletaGanadora = false;
                            }
                        } else {
                            partidoExtraviado = true;
                        }
                    } else {
                        todosFinalizados = false; 
                    }
                } else {
                    partidoExtraviado = true; 
                }
            }

            if (todosFinalizados) {
                apuesta.resuelta = true;
                if (partidoExtraviado) {
                    apuesta.estado = 'cancelada';
                    apuesta.gananciaPosible = apuesta.monto; 
                    gananciasRecuperadas += apuesta.monto;
                } else if (boletaGanadora) {
                    apuesta.estado = 'ganada';
                    gananciasRecuperadas += apuesta.gananciaPosible;
                } else {
                    apuesta.estado = 'perdida';
                }
                actualizarApuestaBD(apuesta.id, apuesta.estado, true);
                actualizadas = true;
            }
        }
    }

    if (gananciasRecuperadas > 0) { actualizarSaldoBD(gananciasRecuperadas); }
    if (actualizadas) { renderizarHistorial(); }
}

setInterval(() => {
    if(currentUserId && apuestasUsuario.some(a => a.estado === 'pendiente')) {
        resolverApuestasOffline();
    }
}, 15000);

function renderizarMisPartidosEnVivo() {
    const contenedor = document.getElementById('live-user-matches');
    if (!contenedor) return;

    let partidosApostadosIds = new Set();
    apuestasUsuario.forEach(apuesta => {
        if (apuesta.estado === 'pendiente' && apuesta.selecciones) {
            apuesta.selecciones.forEach(sel => partidosApostadosIds.add(sel.partidoId));
        }
    });

    let partidosEnVivo = partidosActuales.filter(p => partidosApostadosIds.has(p.id));

    if (partidosEnVivo.length === 0) {
        contenedor.innerHTML = '<p class="empty-msg">No tienes apuestas activas en vivo en este momento.</p>';
        return;
    }

    let html = '';
    const now = Math.floor(Date.now() / 1000); 
    let secActuales = now % globalCycleLength;
    let tiempoJugadoGlobal = secActuales - globalBetTime + 1;
    let enFaseApuestas = secActuales < globalBetTime;

    partidosEnVivo.forEach(p => {
        let resText = p.deporte === 'UFC' ? `<img src="imagen_ufc.png" class="custom-emoji" alt="UFC"> EN PELEA` : `${p.golesL} : ${p.golesV}`;
        let display = "Por empezar...";
        let pTerminado = p.finalizado || p.finalizadoGlobal;

        if (enFaseApuestas) {
            display = "Fase de Apuestas";
        } else if (tiempoJugadoGlobal > 0) {
            let conf = configDeportes[p.deporte];
            let m = Math.min(tiempoJugadoGlobal, conf.playTime);
            if (p.deporte === 'Futbol') {
                let maxL = 90 + (p.tiempoExtra || 0);
                if (m > 90 && m <= maxL) display = `90+${m-90}'`;
                else if (m <= 90) display = `${m}'`;
                else { display = 'FINAL'; pTerminado = true; }
            } else {
                display = `${m}'`;
                if (m >= conf.playTime) pTerminado = true;
            }
        }

        if (pTerminado) {
            display = "FINAL";
            if(p.deporte === 'UFC') {
                resText = `Gana: ${p.resultado.ganador === 'L' ? p.local.nombre : p.visitante.nombre}`;
            }
        }
        
        let timeStyle = pTerminado ? "color: #ff4d4d;" : "color: #f185ff;";
        
        html += `
            <div class="live-match-item">
                <div class="live-match-teams">
                    ${p.local.imagen ? `<img src="${p.local.imagen}" class="tiny-logo">` : ''}
                    ${p.local.nombre} vs ${p.visitante.nombre} 
                    ${p.visitante.imagen ? `<img src="${p.visitante.imagen}" class="tiny-logo">` : ''}
                    <span style="font-size:10px; color:#aaa;">(${p.deporte})</span>
                </div>
                <div class="live-match-time" style="${timeStyle}">${display}</div>
                <div class="live-match-score">${resText}</div>
            </div>
        `;
    });
    
    contenedor.innerHTML = html;
}
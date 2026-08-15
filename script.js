const supabaseUrl = 'https://wgqqbahoalozgfukioza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndncXFiYWhvYWxvemdmdWtpb3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTA3OTYsImV4cCI6MjA5OTgyNjc5Nn0.v_kpYceS8ceIUBNaLLHjfyBeFA2Y3lDRy7Yn6cb5Uz8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const authSection = document.getElementById('auth-section');
const juegosSection = document.getElementById('juegos-section');
const deportesSection = document.getElementById('deportes-section');
const rankingSection = document.getElementById('ranking-section');
const header = document.getElementById('user-header');
const userEmailSpan = document.getElementById('user-email');

let currentUserId = null;
let currentSaldo = 0;
let totalApostadoGlobal = 0;

// Variables Globales de Deportes
let timerInterval = null;
let tiempoRestante = 30;
let faseApuestasAbierta = true;
let equiposGlobales = [];
let partidosActuales = [];
let apuestasUsuario = []; 
let ticketSelecciones = []; 
let currentRoundId = -1; // Usado para sincronización global

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login').addEventListener('click', iniciarSesion);
    document.getElementById('btn-register').addEventListener('click', crearCuenta);
    document.getElementById('btn-reset').addEventListener('click', recuperarPassword);
    document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

    document.getElementById('link-to-register').addEventListener('click', () => mostrarFormulario('register-box'));
    document.getElementById('link-to-reset').addEventListener('click', () => mostrarFormulario('reset-box'));
    document.getElementById('link-to-login-1').addEventListener('click', () => mostrarFormulario('login-box'));
    document.getElementById('link-to-login-2').addEventListener('click', () => mostrarFormulario('login-box'));

    // Autorrecarga Events
    document.getElementById('btn-deposit-main').addEventListener('click', () => {
        document.getElementById('deposit-dropdown').classList.toggle('show');
    });
    document.getElementById('btn-confirm-deposit').addEventListener('click', autoRecarga);

    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); 
            navItems.forEach(nav => nav.classList.remove('active'));
            e.target.classList.add('active');

            juegosSection.classList.add('hidden');
            deportesSection.classList.add('hidden');
            rankingSection.classList.add('hidden');

            if (e.target.id === 'btn-nav-juegos') {
                juegosSection.classList.remove('hidden');
            } else if (e.target.id === 'btn-nav-deportes') {
                deportesSection.classList.remove('hidden');
                inicializarDeportes();
            } else if (e.target.id === 'btn-nav-ranking') {
                rankingSection.classList.remove('hidden');
                cargarRanking();
            }
        });
    });
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUserId = session.user.id;
        authSection.classList.add('hidden');
        juegosSection.classList.remove('hidden');
        deportesSection.classList.add('hidden');
        rankingSection.classList.add('hidden');
        
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.getElementById('btn-nav-juegos').classList.add('active');

        header.classList.remove('hidden');
        userEmailSpan.innerText = `Jugador: ${session.user.email}`;
       
        cargarSaldoYDatos(session.user.id);
        cargarJuegos();
        cargarHistorialDesdeBD();
    } else {
        currentUserId = null;
        detenerDeportes();
        authSection.classList.remove('hidden');
        juegosSection.classList.add('hidden');
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

// --- LOGICA DE AUTORRECARGA ---
function autoRecarga() {
    if (!currentUserId) return;
    const now = Date.now();
    const lastDeposit = localStorage.getItem('last_deposit_time_' + currentUserId) || 0;
    const cooldown = 5 * 60 * 1000; // 5 minutos

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
        document.getElementById('deposit-dropdown').classList.remove('show');
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

// --- RANKING CON PORCENTAJE DE LUDOPATÍA ---
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
            let medalla = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
            
            let apostado = perfil.total_apostado || 0;
            let saldoActual = perfil.saldo || 0;
            
            let porcentajeLudopatia = 0;
            if (apostado > 0) {
                porcentajeLudopatia = ((apostado / (apostado + saldoActual)) * 100).toFixed(1);
            }

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
    } catch(e) {
        contenedor.innerHTML = '<p>Error al cargar el ranking.</p>';
    }
}

// --- HISTORIAL BASE DE DATOS ---

async function cargarHistorialDesdeBD() {
    apuestasUsuario = [];
    const contenedor = document.getElementById('history-items');
    contenedor.innerHTML = '<p class="empty-msg">Cargando...</p>';
    
    const { data, error } = await supabaseClient.from('historial_apuestas')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: true }); 

    if (data) {
        apuestasUsuario = data;
    }
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
        if(index !== -1) { apuestasUsuario[index] = data; }
    }
}

async function actualizarApuestaBD(apuestaDbId, estado, resuelta) {
    if(String(apuestaDbId).length > 13) { 
        await supabaseClient.from('historial_apuestas')
            .update({ estado: estado, resuelta: resuelta })
            .eq('id', apuestaDbId);
    }
}

window.borrarHistorialBD = async function() {
    if(!confirm("¿Estás seguro de borrar todo tu historial de apuestas?")) return;
    document.getElementById('history-items').innerHTML = '<p class="empty-msg">Borrando...</p>';
    await supabaseClient.from('historial_apuestas').delete().eq('user_id', currentUserId);
    apuestasUsuario = [];
    renderizarHistorial();
}

// =========================================================================
// SISTEMA AUTOMATIZADO DE DEPORTES VIRTUALES (SINCRONIZADO GLOBALMENTE)
// =========================================================================

async function inicializarDeportes() {
    if (equiposGlobales.length === 0) {
        const contenedor = document.getElementById('contenedor-partidos');
        contenedor.innerHTML = '<p>Buscando equipos en la base de datos...</p>';
        try {
            const { data: equipos, error } = await supabaseClient.from('equipos').select('*');
            if (error) throw error;
            if (!equipos || equipos.length < 2) return;
            equiposGlobales = equipos;
        } catch (error) { contenedor.innerHTML = '<p style="color:#ff4d4d;">Error de base de datos.</p>'; return; }
    }
    
    if (!timerInterval) {
        currentRoundId = -1; // Fuerza la inicialización
        cicloDeportes(); // Llamada inmediata
        timerInterval = setInterval(cicloDeportes, 1000);
    }
    renderizarHistorial();
}

function detenerDeportes() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// Función matemática que genera el MISMO número aleatorio a partir de una semilla
function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// Mezcla los equipos de la misma forma exacta para todos los usuarios dependiendo del Round ID
function mezclarArrayDeterminista(array, seed) {
    let arr = [...array];
    let currentSeed = seed;
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(currentSeed++) * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function calcularCuotas(local, visitante) {
    let fuerzaL = (local.estadistica_ataque || 10) + (local.estadistica_defensa || 10);
    let fuerzaV = (visitante.estadistica_ataque || 10) + (visitante.estadistica_defensa || 10);
    let total = fuerzaL + fuerzaV;

    let probL = (fuerzaL / total) * 0.75; 
    let probV = (fuerzaV / total) * 0.75;
    let probE = 1 - (probL + probV); 

    const margen = 1.15; 

    return {
        L: (1 / (probL * margen)).toFixed(2),
        E: (1 / (probE * margen)).toFixed(2),
        V: (1 / (probV * margen)).toFixed(2),
        LE: (1 / ((probL + probE) * margen)).toFixed(2),
        VE: (1 / ((probV + probE) * margen)).toFixed(2),
        Mas25: (1.85).toFixed(2), 
        Menos25: (1.95).toFixed(2)
    };
}

function iniciarRondaSincronizada(roundId) {
    faseApuestasAbierta = true;
    partidosActuales = [];
    limpiarTicket();
    
    // Todos los usuarios mezclan los equipos basados en el RoundId Universal
    const equiposMezclados = mezclarArrayDeterminista(equiposGlobales, roundId);
    
    for (let i = 0; i < equiposMezclados.length - 1; i += 2) {
        let local = equiposMezclados[i];
        let visitante = equiposMezclados[i+1];
        let cuotas = calcularCuotas(local, visitante);
        
        partidosActuales.push({
            id: `match_${local.id}_${visitante.id}`,
            local, visitante, cuotas,
            golesL: 0, golesV: 0, finalizado: false
        });
    }
    
    renderizarPartidos();
}

function cicloDeportes() {
    const cycleLength = 30; // 30 segundos exactos
    const now = Math.floor(Date.now() / 1000); // Segundos universales
    const roundId = Math.floor(now / cycleLength);
    tiempoRestante = cycleLength - (now % cycleLength);
    
    // Si cambia el bloque de tiempo (Round ID), lanzamos nueva ronda sincronizada
    if (currentRoundId !== roundId) {
        currentRoundId = roundId;
        iniciarRondaSincronizada(roundId);
    }

    const timerDisplay = document.getElementById('sports-timer');
    const statusDisplay = document.getElementById('sports-status');
    
    timerDisplay.innerText = `${tiempoRestante}s`;

    if (tiempoRestante > 10) {
        faseApuestasAbierta = true;
        statusDisplay.innerText = "Fase de Apuestas - ¡Hagan sus juegos!";
        statusDisplay.style.color = "#2ecc71";
        habilitarBotonesApuesta();
    } else if (tiempoRestante <= 10 && tiempoRestante > 5) {
        if (faseApuestasAbierta) {
            faseApuestasAbierta = false;
            deshabilitarBotonesApuesta();
            if(ticketSelecciones.length > 0) limpiarTicket();
        }
        statusDisplay.innerText = "Apuestas Cerradas - Preparando...";
        statusDisplay.style.color = "#f39c12";
    } else if (tiempoRestante <= 5) {
        if (partidosActuales.length > 0 && !partidosActuales[0].finalizado) {
            statusDisplay.innerText = "Simulando Partidos...";
            statusDisplay.style.color = "#e74c3c";
            simularTodosLosPartidosSincronizado(roundId);
        } else if (partidosActuales.length === 0) {
            statusDisplay.innerText = "Cargando...";
        }
    }
}

function renderizarPartidos() {
    const contenedor = document.getElementById('contenedor-partidos');
    contenedor.innerHTML = ''; 

    partidosActuales.forEach(partido => {
        const matchCard = document.createElement('div');
        matchCard.className = 'match-card';
        matchCard.innerHTML = `
            <div class="match-header">
                <div class="team-info">
                    <h3>${partido.local.nombre}</h3>
                    <span class="team-stats">ATK: ${partido.local.estadistica_ataque} | DEF: ${partido.local.estadistica_defensa}</span>
                </div>
                <div class="match-center">
                    <div id="res-${partido.id}" class="result-display">VS</div>
                </div>
                <div class="team-info">
                    <h3>${partido.visitante.nombre}</h3>
                    <span class="team-stats">ATK: ${partido.visitante.estadistica_ataque} | DEF: ${partido.visitante.estadistica_defensa}</span>
                </div>
            </div>
            
            <div class="betting-panel">
                <div class="odds-grid top-row">
                    <button id="btn-${partido.id}-L" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'L', ${partido.cuotas.L}, '${partido.local.nombre}', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Local: ${partido.cuotas.L}</button>
                    <button id="btn-${partido.id}-E" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'E', ${partido.cuotas.E}, 'Empate', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Empate: ${partido.cuotas.E}</button>
                    <button id="btn-${partido.id}-V" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'V', ${partido.cuotas.V}, '${partido.visitante.nombre}', '${partido.local.nombre} vs ${partido.visitante.nombre}')">Visita: ${partido.cuotas.V}</button>
                </div>
                <div class="odds-grid sub-row">
                    <button id="btn-${partido.id}-LE" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'LE', ${partido.cuotas.LE}, 'Local/Empate', '${partido.local.nombre} vs ${partido.visitante.nombre}')">1X: ${partido.cuotas.LE}</button>
                    <button id="btn-${partido.id}-VE" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'VE', ${partido.cuotas.VE}, 'Visita/Empate', '${partido.local.nombre} vs ${partido.visitante.nombre}')">X2: ${partido.cuotas.VE}</button>
                    <button id="btn-${partido.id}-Mas25" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'Mas25', ${partido.cuotas.Mas25}, '+2.5 Goles', '${partido.local.nombre} vs ${partido.visitante.nombre}')">+2.5: ${partido.cuotas.Mas25}</button>
                    <button id="btn-${partido.id}-Menos25" class="btn-odd" onclick="toggleSeleccion('${partido.id}', 'Menos25', ${partido.cuotas.Menos25}, '-2.5 Goles', '${partido.local.nombre} vs ${partido.visitante.nombre}')">-2.5: ${partido.cuotas.Menos25}</button>
                </div>
            </div>
        `;
        contenedor.appendChild(matchCard);
    });
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

// --- LOGICA DE TICKET DE APUESTA ---

window.toggleSeleccion = function(partidoId, tipo, cuota, labelDesc, partidoNombres) {
    if (!faseApuestasAbierta) return;

    const indexIndex = ticketSelecciones.findIndex(s => s.partidoId === partidoId);
    
    if (indexIndex > -1) {
        if (ticketSelecciones[indexIndex].tipo === tipo) { ticketSelecciones.splice(indexIndex, 1); } 
        else { ticketSelecciones[indexIndex] = { partidoId, tipo, cuota, labelDesc, partidoNombres }; }
    } else { ticketSelecciones.push({ partidoId, tipo, cuota, labelDesc, partidoNombres }); }

    actualizarUIBotones();
    actualizarTicketUI();
}

function actualizarUIBotones() {
    document.querySelectorAll('.btn-odd').forEach(btn => btn.classList.remove('selected'));
    ticketSelecciones.forEach(sel => {
        const btn = document.getElementById(`btn-${sel.partidoId}-${sel.tipo}`);
        if(btn) btn.classList.add('selected');
    });
}

function actualizarTicketUI() {
    const ticketPanel = document.getElementById('bet-ticket');
    const itemsContainer = document.getElementById('ticket-items');
    
    if (ticketSelecciones.length === 0) {
        ticketPanel.classList.add('hidden'); return;
    }

    ticketPanel.classList.remove('hidden');
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
    if (!faseApuestasAbierta) return;
    if (ticketSelecciones.length === 0) return;

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
}

// --- LOGICA DE HISTORIAL VISUAL ---

function renderizarHistorial() {
    const contenedor = document.getElementById('history-items');
    
    if (!apuestasUsuario || apuestasUsuario.length === 0) {
        contenedor.innerHTML = '<p class="empty-msg">No hay apuestas recientes.</p>';
        return;
    }

    contenedor.innerHTML = '';
    
    const historialReverso = [...apuestasUsuario].reverse();

    historialReverso.forEach(apuesta => {
        let estadoClass = '';
        let estadoTexto = '';

        if (apuesta.estado === 'pendiente') {
            estadoClass = 'status-pending'; estadoTexto = 'Pendiente ⏳';
        } else if (apuesta.estado === 'ganada') {
            estadoClass = 'status-won'; estadoTexto = 'Ganada ✅';
        } else {
            estadoClass = 'status-lost'; estadoTexto = 'Perdida ❌';
        }

        let seleccionesHTML = '';
        if (apuesta.selecciones && Array.isArray(apuesta.selecciones)) {
            seleccionesHTML = apuesta.selecciones.map(sel => 
                `<div class="hist-sel-row">
                    <span class="hist-match">${sel.partidoNombres}</span>
                    <span class="hist-pick">${sel.labelDesc} (${(sel.cuota || 0).toFixed(2)})</span>
                </div>`
            ).join('');
        }

        contenedor.innerHTML += `
            <div class="history-item ${estadoClass}">
                <div class="hist-header">
                    <span class="hist-type">${apuesta.tipoBoleta}</span>
                    <span class="hist-status">${estadoTexto}</span>
                </div>
                <div class="hist-body">
                    ${seleccionesHTML}
                </div>
                <div class="hist-footer">
                    <span>Apostado: <b>$${(apuesta.monto || 0).toFixed(2)}</b></span>
                    <span>Retorno: <b>$${apuesta.estado === 'ganada' ? (apuesta.gananciaPosible || 0).toFixed(2) : (apuesta.estado === 'perdida' ? '0.00' : (apuesta.gananciaPosible || 0).toFixed(2))}</b></span>
                </div>
            </div>
        `;
    });
}

// --- LOGICA DE RESOLUCIÓN SINCRONIZADA ---

function simularTodosLosPartidosSincronizado(roundId) {
    // Al usar el ID del round como semilla, TODOS los usuarios ven los mismos goles
    let seed = roundId * 100; 

    partidosActuales.forEach(partido => {
        let atkL = partido.local.estadistica_ataque || 10;
        let defL = partido.local.estadistica_defensa || 10;
        let atkV = partido.visitante.estadistica_ataque || 10;
        let defV = partido.visitante.estadistica_defensa || 10;

        let suerteL = seededRandom(seed++) * 100 + (atkL - defV) * 0.5; 
        let suerteV = seededRandom(seed++) * 100 + (atkV - defL) * 0.5;

        partido.golesL = Math.floor(Math.max(0, suerteL / 35)); 
        partido.golesV = Math.floor(Math.max(0, suerteV / 35));

        if (seededRandom(seed++) < 0.15) { 
            partido.golesL = Math.floor(seededRandom(seed++) * 4);
            partido.golesV = Math.floor(seededRandom(seed++) * 4);
        }

        partido.finalizado = true;
        document.getElementById(`res-${partido.id}`).innerText = `${partido.golesL} : ${partido.golesV}`;
    });

    resolverApuestas();
}

function verificarSeleccion(seleccion, partido) {
    const gl = partido.golesL;
    const gv = partido.golesV;
    const totalGoles = gl + gv;

    switch (seleccion.tipo) {
        case 'L': return gl > gv;
        case 'E': return gl === gv;
        case 'V': return gl < gv;
        case 'LE': return gl >= gv;
        case 'VE': return gv >= gl;
        case 'Mas25': return totalGoles > 2.5;
        case 'Menos25': return totalGoles < 2.5;
        default: return false;
    }
}

function resolverApuestas() {
    let gananciasRonda = 0;

    apuestasUsuario.forEach(apuesta => {
        if (apuesta.resuelta) return; 

        let boletaGanadora = true;

        for (let sel of apuesta.selecciones) {
            const partidoReal = partidosActuales.find(p => p.id === sel.partidoId);
            if (partidoReal && partidoReal.finalizado) {
                if (!verificarSeleccion(sel, partidoReal)) {
                    boletaGanadora = false; break;
                }
            } else {
                boletaGanadora = false; break;
            }
        }

        apuesta.resuelta = true; 

        if (boletaGanadora) {
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
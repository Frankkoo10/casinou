let currentUserId = null;
let currentPerfil = null;
let currentEmail = '';
let apuestasCache = [];
let filtroApuestas = 'todas';
let operadoresMapCuenta = {};
let promosCache = [];

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.acc-nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => mostrarVista(btn.dataset.view));
    });
    document.getElementById('acc-logout').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'https://frankkoo10.github.io/casinou/';
    });
    document.getElementById('dep-enviar').addEventListener('click', solicitarDeposito);
    document.querySelectorAll('#dep-quick-amounts button').forEach((btn) => {
        btn.addEventListener('click', () => {
            const inp = document.getElementById('dep-monto');
            inp.value = (parseFloat(inp.value) || 0) + Number(btn.dataset.add);
        });
    });
    document.getElementById('ret-enviar').addEventListener('click', solicitarRetiro);
    document.getElementById('promo-btn-canjear').addEventListener('click', canjearPromoUI);
    document.querySelectorAll('.wallet-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            setModoBilletera(btn.dataset.wallet);
            pintarSelectorBilleteraCuenta();
        });
    });
    document.getElementById('dat-guardar').addEventListener('click', guardarDatos);
    document.querySelectorAll('.acc-subtab').forEach((btn) => {
        btn.addEventListener('click', () => mostrarSubtab(btn.dataset.subtab));
    });
    document.getElementById('side-depositar').addEventListener('click', () => { mostrarVista('deposito'); mostrarSubtab('dep-form-deposito'); });
    document.getElementById('side-retirar').addEventListener('click', () => { mostrarVista('deposito'); mostrarSubtab('dep-form-retiro'); });
    document.querySelectorAll('.chip').forEach((c) => {
        c.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach((x) => x.classList.remove('active'));
            c.classList.add('active');
            filtroApuestas = c.dataset.filtro;
            renderApuestas();
        });
    });
    document.querySelectorAll('[data-limite]').forEach((btn) => {
        btn.addEventListener('click', () => guardarLimite(btn.dataset.limite));
    });
    document.querySelectorAll('[data-horas]').forEach((btn) => {
        btn.addEventListener('click', () => activarDescanso(Number(btn.dataset.horas)));
    });
    document.querySelectorAll('[data-auto]').forEach((btn) => {
        btn.addEventListener('click', () => activarAuto(Number(btn.dataset.auto)));
    });
    document.getElementById('btn-cerrar-cuenta').addEventListener('click', cerrarCuenta);

    const hash = (location.hash || '').replace('#', '');
    if (hash) mostrarVista(hash);
});

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session) {
        window.location.href = 'https://frankkoo10.github.io/casinou/';
        return;
    }
    currentUserId = session.user.id;
    currentEmail = session.user.email || '';
    await refrescar();
});

function mostrarVista(id) {
    if (id === 'retiro') id = 'deposito'; // compatibilidad con enlaces/hash viejos
    document.querySelectorAll('.acc-view').forEach((v) => v.classList.add('hidden'));
    document.querySelectorAll('.acc-nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === id));
    const view = document.getElementById('view-' + id);
    if (view) view.classList.remove('hidden');
    const titles = {
        resumen: 'Resumen',
        deposito: 'Depósito / Retiro',
        apuestas: 'Historial de apuestas',
        transacciones: 'Transacciones',
        promociones: 'Promociones',
        pyg: 'Apuestas ganadas y perdidas',
        datos: 'Datos personales',
        proteccion: 'Protección al jugador'
    };
    document.getElementById('acc-title').innerText = titles[id] || 'Mi cuenta';
    if (id === 'apuestas') cargarApuestas();
    if (id === 'transacciones') cargarTransacciones();
    if (id === 'deposito') { cargarOperadoresParaDeposito(); cargarSolicitudes(); }
    if (id === 'pyg') cargarPyG();
    if (id === 'promociones') cargarPromociones();
}

function mostrarSubtab(id) {
    document.querySelectorAll('.acc-subform').forEach((f) => f.classList.add('hidden'));
    document.querySelectorAll('.acc-subtab').forEach((b) => b.classList.toggle('active', b.dataset.subtab === id));
    const f = document.getElementById(id);
    if (f) f.classList.remove('hidden');
}

async function refrescar() {
    currentPerfil = await cargarPerfilCompleto(currentUserId);
    if (aplicarSeparacionDeRoles(currentPerfil, 'jugador')) return;
    const nombre = (currentPerfil && currentPerfil.username) || currentEmail;
    document.getElementById('acc-username').innerText = nombre;
    const saldo = currentPerfil ? (currentPerfil.saldo || 0) : 0;
    const bono = currentPerfil ? (currentPerfil.bonus_balance || 0) : 0;
    ['res-saldo', 'side-saldo', 'side-apostar', 'side-retiro', 'pyg-saldo'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerText = formatMoney(saldo);
    });
    ['promo-bono-actual', 'promo-bono-actual-side'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerText = formatMoney(bono);
    });
    document.getElementById('res-apostado').innerText = formatMoney(currentPerfil ? currentPerfil.total_apostado || 0 : 0);
    pintarSelectorBilleteraCuenta();

    document.getElementById('dat-username').value = (currentPerfil && currentPerfil.username) || '';
    document.getElementById('dat-email').value = currentEmail;
    document.getElementById('dat-edad').value = (currentPerfil && currentPerfil.edad) || '';
    if (currentPerfil && currentPerfil.estado_civil) document.getElementById('dat-civil').value = currentPerfil.estado_civil;

    pintarProteccion();
    await cargarApuestas();
    await cargarReciente();
}

function pintarProteccion() {
    const p = currentPerfil || {};
    document.getElementById('prot-lim-dep').innerText = p.limite_deposito_diario
        ? 'Diario ' + formatMoney(p.limite_deposito_diario) : 'No se configuró';
    document.getElementById('prot-lim-dep-s').innerText = p.limite_perdida_deportes
        ? formatMoney(p.limite_perdida_deportes) : 'No se configuró';
    document.getElementById('prot-lim-cas').innerText = p.limite_perdida_casino
        ? formatMoney(p.limite_perdida_casino) : 'No se configuró';

    const t = timeoutActivo(p);
    const dEl = document.getElementById('prot-descanso-estado');
    if (t && t.tipo === 'descanso') dEl.innerText = 'Activo · resta ' + formatRestante(t.until);
    else dEl.innerText = 'No se configuró';

    const aEl = document.getElementById('prot-auto-estado');
    if (t && t.tipo === 'autoexclusion') aEl.innerText = 'Activo · resta ' + formatRestante(t.until);
    else aEl.innerText = 'No está activo';

    document.getElementById('prot-cierre-estado').innerText = p.cuenta_cerrada ? 'Cuenta cerrada' : 'No está activo';
}

async function cargarApuestas() {
    const { data } = await supabaseClient
        .from('historial_apuestas')
        .select('*')
        .eq('user_id', currentUserId)
        .order('id', { ascending: false });
    apuestasCache = data || [];
    const abiertas = apuestasCache.filter((a) => a.estado === 'pendiente').length;
    document.getElementById('res-abiertas').innerText = String(abiertas);
    document.getElementById('side-abiertas').innerText = String(abiertas);
    renderApuestas();
}

function renderApuestas() {
    const box = document.getElementById('apuestas-lista');
    let list = apuestasCache;
    if (filtroApuestas !== 'todas') list = list.filter((a) => a.estado === filtroApuestas);
    if (!list.length) {
        box.innerHTML = '<p class="empty-msg">No hay apuestas en este filtro.</p>';
        return;
    }
    box.innerHTML = list.map((a) => {
        let sels = a.selecciones;
        if (typeof sels === 'string') {
            try { sels = JSON.parse(sels); } catch (e) { sels = []; }
        }
        const picks = Array.isArray(sels)
            ? sels.map((s) => `<div class="hist-sel-row"><span>${escapeHtml(s.partidoNombres || '')}</span><span>${escapeHtml(s.labelDesc || '')}</span></div>`).join('')
            : '';
        return `<article class="history-item status-${a.estado || 'pending'}">
            <div class="hist-header"><span>${escapeHtml(a.tipoBoleta || 'Simple')}</span><span>${escapeHtml(a.estado || '')}</span></div>
            <div class="hist-body">${picks}</div>
            <div class="hist-footer"><span>Apostado ${formatMoney(a.monto)}</span><span>Retorno ${a.estado === 'ganada' ? formatMoney(a.gananciaPosible) : (a.estado === 'pendiente' ? 'Pendiente' : formatMoney(0))}</span></div>
        </article>`;
    }).join('');
}

async function cargarReciente() {
    const box = document.getElementById('res-reciente');
    const top = apuestasCache.slice(0, 5);
    if (!top.length) {
        box.innerHTML = '<p class="empty-msg">Todavía no hay actividad.</p>';
        return;
    }
    box.innerHTML = top.map((a) => `<div class="acc-line"><span>${escapeHtml(a.tipoBoleta)} · ${escapeHtml(a.estado)}</span><strong>${formatMoney(a.monto)}</strong></div>`).join('');
}

async function cargarTransacciones() {
    const box = document.getElementById('tx-lista');
    const { data, error } = await supabaseClient
        .from('transacciones')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50);
    if (error) {
        box.innerHTML = '<p class="empty-msg">Corrê el SQL para ver movimientos.</p>';
        return;
    }
    if (!data || !data.length) {
        box.innerHTML = '<p class="empty-msg">Sin movimientos todavía.</p>';
        return;
    }
    box.innerHTML = data.map((t) => `<div class="acc-line"><span>${escapeHtml(t.tipo)} · ${escapeHtml(t.descripcion || '')}<br><small>${formatFecha(t.created_at)}</small></span><strong>${formatMoney(t.monto)}</strong></div>`).join('');
}

async function cargarPyG() {
    const apostado = apuestasCache.reduce((s, a) => s + Number(a.monto || 0), 0);
    const ganado = apuestasCache.filter((a) => a.estado === 'ganada').reduce((s, a) => s + Number(a.gananciaPosible || 0), 0);
    const perdido = apuestasCache.filter((a) => a.estado === 'perdida').reduce((s, a) => s + Number(a.monto || 0), 0);
    const neto = ganado - apostado;
    document.getElementById('pyg-riesgo').innerText = formatMoney(apostado);
    document.getElementById('pyg-ganado').innerText = formatMoney(ganado);
    const netoEl = document.getElementById('pyg-neto');
    netoEl.innerText = formatMoney(neto);
    netoEl.style.color = neto >= 0 ? '#2ecc71' : '#ff4d4d';
    document.getElementById('pyg-lista').innerHTML = `
        <div class="acc-line"><span>Apuestas ganadas</span><strong>${apuestasCache.filter((a) => a.estado === 'ganada').length}</strong></div>
        <div class="acc-line"><span>Apuestas perdidas</span><strong>${apuestasCache.filter((a) => a.estado === 'perdida').length}</strong></div>
        <div class="acc-line"><span>Dinero perdido en fallidas</span><strong>${formatMoney(perdido)}</strong></div>
    `;
}

async function cargarOperadoresParaDeposito() {
    const select = document.getElementById('dep-operador');
    const operadores = await cargarListaOperadores();
    operadoresMapCuenta = {};
    operadores.forEach((o) => { operadoresMapCuenta[o.id] = o.username; });
    pintarSelectOperadores(select, operadores);
}

function nombreOperador(id) {
    if (!id) return 'Sin asignar';
    return operadoresMapCuenta[id] || 'Operador';
}

async function cargarSolicitudes() {
    const box = document.getElementById('dep-lista');
    const { data, error } = await supabaseClient
        .from('solicitudes_carga')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });
    if (error) {
        box.innerHTML = '<p class="empty-msg">Corrê el SQL para activar depósitos de cajero.</p>';
        return;
    }
    if (!data || !data.length) {
        box.innerHTML = '<p class="empty-msg">Sin solicitudes.</p>';
        return;
    }
    box.innerHTML = data.map((s) => {
        const tipo = s.tipo || (s.metodo === 'retiro' ? 'retiro' : 'deposito');
        const detalle = tipo === 'retiro' ? 'Retiro' : ('Para ' + escapeHtml(nombreOperador(s.operador_id)));
        return `<div class="acc-line"><span>${detalle} · ${escapeHtml(s.estado)}<br><small>${formatFecha(s.created_at)}</small></span><strong>${formatMoney(s.monto)}</strong></div>`;
    }).join('');
}

async function solicitarDeposito() {
    const msg = document.getElementById('dep-msg');
    if (timeoutActivo(currentPerfil)) {
        msg.innerText = 'Estás en pausa. No se puede depositar.';
        msg.style.color = '#ff4d4d';
        return;
    }
    const monto = parseFloat(document.getElementById('dep-monto').value);
    const operadorId = document.getElementById('dep-operador').value;
    if (!Number.isFinite(monto) || monto < 100) {
        msg.innerText = 'Monto mínimo $100.';
        msg.style.color = '#ff4d4d';
        return;
    }
    if (!operadorId) {
        msg.innerText = 'Elegí a qué operador le mandás la solicitud.';
        msg.style.color = '#ff4d4d';
        return;
    }
    const { error } = await supabaseClient.from('solicitudes_carga').insert([{
        user_id: currentUserId, monto, metodo: 'Cajero', estado: 'pendiente', tipo: 'deposito', operador_id: operadorId
    }]);
    if (error) {
        msg.innerText = 'Error: ' + error.message;
        msg.style.color = '#ff4d4d';
        return;
    }
    msg.innerText = 'Solicitud enviada al operador.';
    msg.style.color = '#2ecc71';
    document.getElementById('dep-monto').value = 5000;
    cargarSolicitudes();
}

async function solicitarRetiro() {
    const msg = document.getElementById('ret-msg');
    const monto = parseFloat(document.getElementById('ret-monto').value);
    if (!Number.isFinite(monto) || monto < 100) {
        msg.innerText = 'Monto mínimo $100.';
        msg.style.color = '#ff4d4d';
        return;
    }
    if (!currentPerfil || monto > Number(currentPerfil.saldo || 0)) {
        msg.innerText = 'Saldo insuficiente.';
        msg.style.color = '#ff4d4d';
        return;
    }
    const { error } = await supabaseClient.from('solicitudes_carga').insert([{
        user_id: currentUserId, monto: Math.abs(monto), metodo: 'retiro', estado: 'pendiente', tipo: 'retiro'
    }]);
    if (error) {
        msg.innerText = 'Error: ' + error.message;
        msg.style.color = '#ff4d4d';
        return;
    }
    msg.innerText = 'Pedido de retiro enviado al operador.';
    msg.style.color = '#2ecc71';
}

async function guardarDatos() {
    const msg = document.getElementById('dat-msg');
    const username = document.getElementById('dat-username').value.trim();
    const edad = parseInt(document.getElementById('dat-edad').value, 10);
    const estado_civil = document.getElementById('dat-civil').value;
    if (username.length < 3) {
        msg.innerText = 'Usuario muy corto.';
        msg.style.color = '#ff4d4d';
        return;
    }
    if (!Number.isFinite(edad) || edad < 18) {
        msg.innerText = 'La edad mínima es 18.';
        msg.style.color = '#ff4d4d';
        return;
    }
    const { error } = await supabaseClient.from('perfiles').update({ username, edad, estado_civil }).eq('id', currentUserId);
    if (error) {
        msg.innerText = 'Error: ' + error.message;
        msg.style.color = '#ff4d4d';
        return;
    }
    msg.innerText = 'Datos guardados.';
    msg.style.color = '#2ecc71';
    await refrescar();
}

async function guardarLimite(col) {
    let inputId = 'inp-lim-dep';
    if (col === 'limite_perdida_deportes') inputId = 'inp-lim-sport';
    if (col === 'limite_perdida_casino') inputId = 'inp-lim-cas';
    const val = parseFloat(document.getElementById(inputId).value);
    if (!Number.isFinite(val) || val <= 0) return;
    await supabaseClient.from('perfiles').update({ [col]: val }).eq('id', currentUserId);
    await refrescar();
}

async function activarDescanso(horas) {
    if (!confirm('Vas a bloquear el casino por ' + horas + ' horas. No se puede deshacer desde acá.')) return;
    const { error } = await supabaseClient.rpc('activar_descanso', { horas });
    if (error) {
        alert('No se pudo activar. Corré el SQL. ' + error.message);
        return;
    }
    await refrescar();
    alert('Descanso activado. El casino queda bloqueado.');
}

async function activarAuto(horas) {
    if (!confirm('Autoexclusión por ' + horas + ' horas. No se puede deshacer desde la app.')) return;
    const { error } = await supabaseClient.rpc('activar_autoexclusion', { horas });
    if (error) {
        alert('No se pudo activar. Corré el SQL. ' + error.message);
        return;
    }
    await refrescar();
}

function pintarSelectorBilleteraCuenta() {
    const modo = obtenerModoBilletera();
    document.querySelectorAll('.wallet-toggle-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.wallet === modo);
    });
}

async function canjearPromoUI() {
    const msg = document.getElementById('promo-msg');
    const input = document.getElementById('promo-input-codigo');
    msg.innerText = 'Canjeando...';
    msg.style.color = '#aaa';
    const resultado = await canjearCodigoPromo(currentUserId, input.value);
    if (!resultado.ok) {
        msg.innerText = resultado.msg;
        msg.style.color = '#ff4d4d';
        return;
    }
    msg.innerText = resultado.msg;
    msg.style.color = '#2ecc71';
    input.value = '';
    await refrescar();
}

async function cargarPromociones() {
    promosCache = await cargarPromosCanjeadas(currentUserId);
    const activas = promosCache.filter((p) => p.promo_codes && p.promo_codes.is_active);
    const vencidas = promosCache.filter((p) => !p.promo_codes || !p.promo_codes.is_active);
    renderListaPromos('promo-lista-activas', activas);
    renderListaPromos('promo-lista-vencidas', vencidas);
}

function renderListaPromos(contenedorId, lista) {
    const box = document.getElementById(contenedorId);
    if (!box) return;
    if (!lista.length) {
        box.innerHTML = '<p class="empty-msg">No hay códigos acá.</p>';
        return;
    }
    box.innerHTML = lista.map((p) => {
        const codeInfo = p.promo_codes || {};
        return `<div class="acc-line">
            <span>${escapeHtml(codeInfo.code || 'Código')}<br><small>${formatFecha(p.created_at)}</small></span>
            <strong>${formatMoney(codeInfo.reward_amount || 0)}</strong>
        </div>`;
    }).join('');
}

async function cerrarCuenta() {
    if (!confirm('¿Cerrar la cuenta? No vas a poder apostar.')) return;
    const { error } = await supabaseClient.from('perfiles').update({ cuenta_cerrada: true }).eq('id', currentUserId);
    if (error) {
        alert(error.message);
        return;
    }
    await refrescar();
}

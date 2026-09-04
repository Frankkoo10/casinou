const SUPABASE_URL = 'https://wgqqbahoalozgfukioza.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndncXFiYWhvYWxvemdmdWtpb3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTA3OTYsImV4cCI6MjA5OTgyNjc5Nn0.v_kpYceS8ceIUBNaLLHjfyBeFA2Y3lDRy7Yn6cb5Uz8';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '$0,00';
    return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#39;');
}

function formatFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeoutActivo(perfil) {
    if (!perfil) return null;
    if (perfil.cuenta_cerrada) return { tipo: 'cerrada', until: null };
    if (perfil.autoexclusion_until && new Date(perfil.autoexclusion_until) > new Date()) {
        return { tipo: 'autoexclusion', until: new Date(perfil.autoexclusion_until) };
    }
    if (perfil.timeout_until && new Date(perfil.timeout_until) > new Date()) {
        return { tipo: 'descanso', until: new Date(perfil.timeout_until) };
    }
    return null;
}

function formatRestante(until) {
    if (!until) return '';
    const ms = until.getTime() - Date.now();
    if (ms <= 0) return '0s';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 48) {
        const d = Math.floor(h / 24);
        return `${d}d ${h % 24}h`;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function cargarPerfilCompleto(userId) {
    const { data, error } = await supabaseClient
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (!error) return data;
    // No existe la fila en "perfiles" para este usuario (pasa si la cuenta se
    // creó a mano desde el panel de Supabase, o si falló el alta al
    // registrarse). La creamos ahora como jugador, para que la app no quede
    // rota. Si ya le subiste el rol a operador con SQL, esto no lo pisa:
    // solo se ejecuta cuando todavía NO hay fila para este id.
    const { data: authData } = await supabaseClient.auth.getUser();
    const user = authData && authData.user;
    if (!user || user.id !== userId) return null;
    const meta = user.user_metadata || {};
    const { data: creado, error: createErr } = await supabaseClient
        .from('perfiles')
        .upsert({
            id: userId,
            username: meta.username || (user.email || 'jugador').split('@')[0],
            edad: meta.edad || null,
            estado_civil: meta.estado_civil || null,
            saldo: 0,
            bonus_balance: 0,
            total_apostado: 0,
            rol: 'jugador'
        }, { onConflict: 'id' })
        .select()
        .single();
    if (createErr) return null;
    return creado;
}

async function cargarListaOperadores() {
    const { data, error } = await supabaseClient
        .from('perfiles')
        .select('id, username')
        .eq('rol', 'operador')
        .order('username', { ascending: true });
    if (error) {
        console.warn('No se pudo cargar la lista de operadores', error);
        return [];
    }
    return data || [];
}

function pintarSelectOperadores(selectEl, operadores) {
    if (!selectEl) return;
    if (!operadores || !operadores.length) {
        selectEl.innerHTML = '<option value="">No hay operadores disponibles todavía</option>';
        return;
    }
    selectEl.innerHTML = '<option value="">Elegí un operador...</option>' +
        operadores.map((o) => `<option value="${o.id}">${escapeHtml(o.username || 'Operador')}</option>`).join('');
}

// =========================================================================
// BILLETERA: SALDO REAL vs SALDO DE BONO
// =========================================================================
// El jugador elige con qué plata juega (real o bono). Se guarda en
// localStorage porque es solo una preferencia de UI, no un dato sensible.
function obtenerModoBilletera() {
    return localStorage.getItem('walletMode') === 'bono' ? 'bono' : 'real';
}

function setModoBilletera(modo) {
    localStorage.setItem('walletMode', modo === 'bono' ? 'bono' : 'real');
}

// Resta "monto" del saldo de BONO de un perfil ya cargado. Devuelve el nuevo
// perfil (con bonus_balance actualizado) o null si no había saldo de bono
// suficiente / falló el update.
async function debitarBono(userId, perfil, monto) {
    const bonoActual = Number((perfil && perfil.bonus_balance) || 0);
    if (monto > bonoActual) return null;
    const nuevoBono = bonoActual - monto;
    const { error } = await supabaseClient.from('perfiles').update({ bonus_balance: nuevoBono }).eq('id', userId);
    if (error) return null;
    return nuevoBono;
}

// Suma "monto" al saldo de bono (se usa al canjear un código).
async function acreditarBono(userId, monto) {
    const { data } = await supabaseClient.from('perfiles').select('bonus_balance').eq('id', userId).single();
    const actual = Number((data && data.bonus_balance) || 0);
    const nuevo = actual + Number(monto);
    const { error } = await supabaseClient.from('perfiles').update({ bonus_balance: nuevo }).eq('id', userId);
    if (error) return null;
    return nuevo;
}

// Canjea un código promocional para el usuario. Reglas:
// - el código tiene que existir y estar activo
// - un mismo usuario no puede canjear el mismo código dos veces
//   (lo bloquea la restricción UNIQUE(user_id, code_id) de user_promos)
// - al canjearlo, reward_amount se suma al saldo de BONO (bonus_balance),
//   nunca al saldo real
async function canjearCodigoPromo(userId, codigoInput) {
    const code = (codigoInput || '').trim().toUpperCase();
    if (!code) return { ok: false, msg: 'Ingresá un código.' };

    const { data: promo, error: promoErr } = await supabaseClient
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();
    if (promoErr || !promo) return { ok: false, msg: 'Ese código no existe o ya no está activo.' };

    const { data: yaUsado } = await supabaseClient
        .from('user_promos')
        .select('id')
        .eq('user_id', userId)
        .eq('code_id', promo.id)
        .maybeSingle();
    if (yaUsado) return { ok: false, msg: 'Ya canjeaste este código antes.' };

    const { error: insErr } = await supabaseClient
        .from('user_promos')
        .insert([{ user_id: userId, code_id: promo.id }]);
    if (insErr) return { ok: false, msg: 'Ya canjeaste este código o hubo un error al registrarlo.' };

    const nuevoBono = await acreditarBono(userId, promo.reward_amount);
    if (nuevoBono === null) return { ok: false, msg: 'No se pudo acreditar el bono. Probá de nuevo.' };

    await registrarTransaccion(userId, 'bono', promo.reward_amount, null, 'Código promo ' + code);

    return { ok: true, monto: promo.reward_amount, nuevoBono, msg: '¡Código canjeado! Se acreditaron ' + formatMoney(promo.reward_amount) + ' a tu saldo de bono.' };
}

// Trae el historial de códigos que un usuario ya canjeó, con los datos del
// código (monto, etc.) para pintar "Promociones activas / vencidas".
async function cargarPromosCanjeadas(userId) {
    const { data, error } = await supabaseClient
        .from('user_promos')
        .select('id, created_at, promo_codes ( code, reward_amount, is_active )')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
}

// Login por nombre de usuario: como el cliente no puede leer auth.users
// directamente (por seguridad/RLS), esto llama a una función de Postgres
// (email_por_username) que hace ese lookup del lado del servidor.
async function resolverEmailParaLogin(userOrEmail) {
    const valor = (userOrEmail || '').trim();
    if (!valor) return null;
    if (valor.includes('@')) return valor; // ya es un email
    try {
        const { data, error } = await supabaseClient.rpc('email_por_username', { p_username: valor });
        if (error || !data) return null;
        return data;
    } catch (e) {
        return null;
    }
}

async function registrarTransaccion(userId, tipo, monto, saldoResultante, descripcion) {
    try {
        await supabaseClient.from('transacciones').insert([{
            user_id: userId,
            tipo,
            monto,
            saldo_resultante: saldoResultante,
            descripcion: descripcion || ''
        }]);
    } catch (e) {
        console.warn('transacciones no disponible', e);
    }
}

// Línea de ayuda por juego compulsivo (Programa de Prevención y Asistencia
// al Juego Compulsivo, Provincia de Buenos Aires). Gratuita, 24hs.
const LUDOPATIA_TEL = '0800-444-4000';

function insertarBotonAyuda() {
    if (document.getElementById('btn-ayuda-flotante')) return;
    const a = document.createElement('a');
    a.href = 'tel:08004444000';
    a.id = 'btn-ayuda-flotante';
    a.className = 'btn-ayuda-ludopatia';
    a.innerHTML = `<span class="dot"></span> Llamá a la línea de ayuda: ${LUDOPATIA_TEL}`;
    document.body.appendChild(a);
}

// Evita que una cuenta con rol operador/admin juegue como jugador, y
// viceversa que un jugador entre a los paneles de gestión. Se llama apenas
// se tiene el perfil cargado. Devuelve true si redirigió (y hay que cortar
// la ejecución del resto de la página).
function aplicarSeparacionDeRoles(perfil, paginaActual) {
    const rol = (perfil && perfil.rol) || 'jugador';
    if (paginaActual === 'jugador' && (rol === 'operador' || rol === 'admin')) {
        alert('Esta cuenta tiene rol ' + rol + '. No puede jugar como usuario. Te llevamos a tu panel.');
        window.location.href = rol === 'admin' ? 'https://frankkoo10.github.io/casinou-admin/' : 'https://frankkoo10.github.io/casinou-operador/';
        return true;
    }
    return false;
}

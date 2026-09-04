// =========================================================
// Integración con Spotify (login real del usuario + reproductor)
// Flujo: Authorization Code con PKCE (no necesita Client Secret,
// apto para un sitio estático como este).
// =========================================================

const SPOTIFY_CONFIG = {
    // Pegá acá el Client ID que te da Spotify al crear la app
    CLIENT_ID: '0c8a124f8e2e4045b6cede340dfcf0bf',
    // Tiene que coincidir EXACTO con lo que pusiste en el dashboard de Spotify
    REDIRECT_URI: 'https://frankkoo10.github.io/casinou/',
    SCOPES: 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state'
};

let spotifyPlayer = null;
let spotifyDeviceId = null;

// ---------- Utilidades PKCE ----------
function spotifyRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values).map((v) => chars[v % chars.length]).join('');
}

async function spotifySha256(plain) {
    const data = new TextEncoder().encode(plain);
    return crypto.subtle.digest('SHA-256', data);
}

function spotifyBase64UrlEncode(arrayBuffer) {
    let str = '';
    const bytes = new Uint8Array(arrayBuffer);
    bytes.forEach((b) => { str += String.fromCharCode(b); });
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------- Login ----------
async function spotifyIniciarLogin() {
    const verifier = spotifyRandomString(64);
    const challenge = spotifyBase64UrlEncode(await spotifySha256(verifier));
    const state = spotifyRandomString(16);
    localStorage.setItem('spotify_code_verifier', verifier);
    localStorage.setItem('spotify_auth_state', state);

    const params = new URLSearchParams({
        client_id: SPOTIFY_CONFIG.CLIENT_ID,
        response_type: 'code',
        redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
        scope: SPOTIFY_CONFIG.SCOPES,
        code_challenge_method: 'S256',
        code_challenge: challenge,
        state
    });
    window.location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
}

// Se llama al cargar la página, por si venimos de vuelta del login de Spotify
async function spotifyManejarRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code) return;

    const savedState = localStorage.getItem('spotify_auth_state');
    if (state !== savedState) return;

    const verifier = localStorage.getItem('spotify_code_verifier');
    const body = new URLSearchParams({
        client_id: SPOTIFY_CONFIG.CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
        code_verifier: verifier
    });

    const resp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });
    const data = await resp.json();
    if (data.access_token) {
        spotifyGuardarTokens(data);
        // Limpiamos el ?code=...&state=... de la URL sin recargar la página
        window.history.replaceState({}, document.title, window.location.pathname);
        spotifyActualizarUI();
        spotifyCargarSDK();
    }
}

function spotifyGuardarTokens(data) {
    localStorage.setItem('spotify_access_token', data.access_token);
    localStorage.setItem('spotify_expires_at', String(Date.now() + data.expires_in * 1000));
    if (data.refresh_token) localStorage.setItem('spotify_refresh_token', data.refresh_token);
}

async function spotifyRefrescarToken() {
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) return null;
    const body = new URLSearchParams({
        client_id: SPOTIFY_CONFIG.CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });
    const resp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });
    const data = await resp.json();
    if (data.access_token) {
        spotifyGuardarTokens(data);
        return data.access_token;
    }
    return null;
}

async function spotifyObtenerToken() {
    const token = localStorage.getItem('spotify_access_token');
    const expiresAt = Number(localStorage.getItem('spotify_expires_at') || 0);
    if (token && Date.now() < expiresAt - 5000) return token;
    return await spotifyRefrescarToken();
}

function spotifyEstaConectado() {
    return !!localStorage.getItem('spotify_refresh_token');
}

function spotifyCerrarSesion() {
    ['spotify_access_token', 'spotify_expires_at', 'spotify_refresh_token', 'spotify_code_verifier', 'spotify_auth_state']
        .forEach((k) => localStorage.removeItem(k));
    if (spotifyPlayer) { spotifyPlayer.disconnect(); spotifyPlayer = null; }
    spotifyActualizarUI();
}

// ---------- Web Playback SDK ----------
function spotifyCargarSDK() {
    if (window.Spotify || document.getElementById('spotify-sdk-script')) {
        if (window.Spotify) spotifyInicializarPlayer();
        return;
    }
    const script = document.createElement('script');
    script.id = 'spotify-sdk-script';
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    document.body.appendChild(script);
}

window.onSpotifyWebPlaybackSDKReady = () => {
    if (spotifyEstaConectado()) spotifyInicializarPlayer();
};

function spotifyInicializarPlayer() {
    if (spotifyPlayer) return;
    spotifyPlayer = new Spotify.Player({
        name: 'Casino Victory - Reproductor',
        getOAuthToken: (cb) => { spotifyObtenerToken().then((t) => cb(t)); },
        volume: 0.5
    });

    spotifyPlayer.addListener('ready', ({ device_id }) => {
        spotifyDeviceId = device_id;
        const msg = document.getElementById('spotify-msg');
        if (msg) msg.innerText = 'Conectado. Elegí qué escuchar.';
    });

    spotifyPlayer.addListener('not_ready', () => { spotifyDeviceId = null; });

    spotifyPlayer.addListener('initialization_error', ({ message }) => spotifyMostrarError(message));
    spotifyPlayer.addListener('authentication_error', ({ message }) => spotifyMostrarError(message));
    spotifyPlayer.addListener('account_error', () => spotifyMostrarError('Hace falta una cuenta Spotify Premium para reproducir.'));

    spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) return;
        spotifyPintarTrackActual(state);
    });

    spotifyPlayer.connect();
}

function spotifyMostrarError(msg) {
    const el = document.getElementById('spotify-msg');
    if (el) { el.innerText = msg; el.style.color = '#ff4d4d'; }
}

function spotifyPintarTrackActual(state) {
    const track = state.track_window.current_track;
    const info = document.getElementById('spotify-track-info');
    const img = document.getElementById('spotify-track-img');
    if (info) info.innerText = `${track.name} — ${track.artists.map((a) => a.name).join(', ')}`;
    if (img && track.album.images[0]) img.src = track.album.images[0].url;
    const btnPlay = document.getElementById('spotify-btn-playpause');
    if (btnPlay) btnPlay.innerText = state.paused ? '▶' : '⏸';
}

// ---------- Controles ----------
async function spotifyTogglePlay() {
    if (!spotifyPlayer) return;
    await spotifyPlayer.togglePlay();
}
async function spotifySiguiente() {
    if (!spotifyPlayer) return;
    await spotifyPlayer.nextTrack();
}
async function spotifyAnterior() {
    if (!spotifyPlayer) return;
    await spotifyPlayer.previousTrack();
}
async function spotifyCambiarVolumen(v) {
    if (!spotifyPlayer) return;
    await spotifyPlayer.setVolume(Number(v));
}

// Reproduce una playlist/álbum/canción a partir de un link de Spotify pegado por el usuario.
// Acepta links tipo https://open.spotify.com/playlist/XXXX o URIs tipo spotify:playlist:XXXX
async function spotifyReproducirLink(link) {
    if (!spotifyDeviceId) { spotifyMostrarError('Todavía se está conectando el reproductor, esperá un segundo.'); return; }
    const uri = spotifyLinkAUri(link);
    if (!uri) { spotifyMostrarError('Pegá un link válido de Spotify (playlist, álbum o canción).'); return; }

    const token = await spotifyObtenerToken();
    const body = uri.includes(':track:') ? { uris: [uri] } : { context_uri: uri };

    const resp = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!resp.ok && resp.status !== 204) {
        const err = await resp.json().catch(() => ({}));
        spotifyMostrarError(err.error && err.error.message ? err.error.message : 'No se pudo reproducir.');
    }
}

function spotifyLinkAUri(link) {
    link = (link || '').trim();
    if (link.startsWith('spotify:')) return link;
    const m = link.match(/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
    if (!m) return null;
    return `spotify:${m[1]}:${m[2]}`;
}

// ---------- UI ----------
function spotifyActualizarUI() {
    const conectado = spotifyEstaConectado();
    const boxLogin = document.getElementById('spotify-login-box');
    const boxPlayer = document.getElementById('spotify-player-box');
    if (boxLogin) boxLogin.classList.toggle('hidden', conectado);
    if (boxPlayer) boxPlayer.classList.toggle('hidden', !conectado);
}

document.addEventListener('DOMContentLoaded', () => {
    spotifyManejarRedirect();
    spotifyActualizarUI();
    if (spotifyEstaConectado()) spotifyCargarSDK();

    const btnAbrir = document.getElementById('btn-open-spotify');
    const btnCerrar = document.getElementById('btn-close-spotify');
    const backdrop = document.getElementById('spotify-backdrop');
    const panel = document.getElementById('spotify-panel');
    if (btnAbrir) btnAbrir.addEventListener('click', () => {
        panel.classList.remove('hidden');
        backdrop.classList.remove('hidden');
    });
    const cerrar = () => { panel.classList.add('hidden'); backdrop.classList.add('hidden'); };
    if (btnCerrar) btnCerrar.addEventListener('click', cerrar);
    if (backdrop) backdrop.addEventListener('click', cerrar);

    const btnLogin = document.getElementById('btn-spotify-login');
    if (btnLogin) btnLogin.addEventListener('click', spotifyIniciarLogin);

    const btnLogout = document.getElementById('btn-spotify-logout');
    if (btnLogout) btnLogout.addEventListener('click', spotifyCerrarSesion);

    const btnPlayPause = document.getElementById('spotify-btn-playpause');
    if (btnPlayPause) btnPlayPause.addEventListener('click', spotifyTogglePlay);

    const btnNext = document.getElementById('spotify-btn-next');
    if (btnNext) btnNext.addEventListener('click', spotifySiguiente);

    const btnPrev = document.getElementById('spotify-btn-prev');
    if (btnPrev) btnPrev.addEventListener('click', spotifyAnterior);

    const volSlider = document.getElementById('spotify-volumen');
    if (volSlider) volSlider.addEventListener('input', (e) => spotifyCambiarVolumen(e.target.value));

    const btnPlayLink = document.getElementById('spotify-btn-play-link');
    if (btnPlayLink) btnPlayLink.addEventListener('click', () => {
        const val = document.getElementById('spotify-link-input').value;
        spotifyReproducirLink(val);
    });
});

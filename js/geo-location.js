/*
 * Geo-location 
 * Bruges til at håndtere geolocation data, samtykke og kort placering.
 */


// Controllers & Constants
const CONSENT_STORAGE_KEY = 'geo-consent-state';
const LOCATION_STORAGE_KEY = 'geo-last-location';
const MSG_DEFAULT = 'Denne app fungerer bedst med adgang til din placering. Tillad adgang?';
const MSG_RETRY = 'Adgang til placering blev tidligere afvist. For at appen kan fungere mere optimalt, skal du tillade adgang til din placering.';
const MSG_DENIED = 'Adgang til placering blev afvist. Appen fungerer bedst med adgang til placering.';
const options = {
    enableHighAccuracy: false,
    timeout: 5000,
    maximumAge: 0
};

// Status variabler
let _userConsented = false;
let _storedConsent = 'unknown';

// samtykke status fra storage
_storedConsent = _loadConsentState();
if (_storedConsent === 'granted') {
    _userConsented = true;
}

// samtykke status opsamler
function _loadConsentState() {
    try {
        return localStorage.getItem(CONSENT_STORAGE_KEY) || 'unknown'; 
    } catch (e) { 
        return 'unknown'; 
    }
}

// Gem samtykke status
function _saveConsentState(state) {
    _storedConsent = state;
    try {
        localStorage.setItem(CONSENT_STORAGE_KEY, state);
    } catch (e) { 
    }
}

// Gem sidste kendte lokation
function _saveLocation(lat, lng) {
    try {
        localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ lat, lng }));
    } catch (e) {
    }
}

// Hent sidste kendte lokation
function _loadLocation() {
    try {
        const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
}

// Position success / error handlers
function _onPositionSuccess(position) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);
    _userConsented = true;
    _saveConsentState('granted');
    _saveLocation(latitude, longitude);
}

function _onPositionError(error) {
    console.error(`Error getting geolocation: ${error && error.message}`);
    if (error && error.code === error.PERMISSION_DENIED) {
        _notifyDenied();
    }
}

// Notificer bruger om afvist adgang
function _notifyDenied() {
    alert(MSG_DENIED);
    _saveConsentState('denied');
    showConsentBanner(true);
}


// Samtykke banner funktioner
// ==========================

// Opret samtykke banner
function createConsentBanner(force = false) {
    if (!force && (_userConsented || _storedConsent === 'granted')) return;
    if (document.getElementById('geo-consent-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'geo-consent-banner';

    // Besked og knapper
    const msg = document.createElement('div');
    msg.id = 'geo-consent-msg';
    msg.textContent = MSG_DEFAULT;
    msg.classList.add('geo-consent-msg');

    const actions = document.createElement('div');
    actions.classList.add('geo-consent-actions');

    // Tillad knap
    const btnAllow = document.createElement('button');
    btnAllow.textContent = 'Tillad placering';
    btnAllow.classList.add('geo-consent-btn', 'geo-consent-btn-allow');
    btnAllow.onclick = () => {
        _userConsented = true;
        removeConsentBanner();
        navigator.geolocation.getCurrentPosition(
            (pos) => { _onPositionSuccess(pos); },
            (err) => {
                if (err && err.code === err.PERMISSION_DENIED) {
                    _userConsented = false;
                    _notifyDenied();
                } else {
                    _onPositionError(err);
                }
            },
            options
        );
    };

    // Afvis knap
    const btnDecline = document.createElement('button');
    btnDecline.textContent = "Afvis placering";
    btnDecline.classList.add('geo-consent-btn', 'geo-consent-btn-decline');
    btnDecline.onclick = () => {
        _userConsented = false;
        alert(MSG_DENIED);
        _saveConsentState('denied');
        showConsentBanner(true);
    };

    // Sammensæt banner
    actions.appendChild(btnAllow);
    actions.appendChild(btnDecline);

    banner.appendChild(msg);
    banner.appendChild(actions);
    document.body.appendChild(banner);
}

// Vis samtykke banner
function showConsentBanner(showRetry = false, force = false) {
    switch (true) {
        case _userConsented: //allerede givet samtykke
            if (!force) return; 
        case !document.getElementById('geo-consent-banner'): // banner ikke oprettet endnu
            createConsentBanner(force);
        default: { // opdater besked hvis nødvendigt
            const msg = document.getElementById('geo-consent-msg');
            if (!msg) return;
            msg.textContent = showRetry ? MSG_RETRY : MSG_DEFAULT;
        }
    }
}

// Fjern samtykke banner
function removeConsentBanner() {
    const banner = document.getElementById('geo-consent-banner');
    if (banner) banner.remove();
}

// Anmod om lokation
function requestLocationOnce() {
    if (!_userConsented) {
        showConsentBanner(false); // vis banner hvis ikke allerede givet samtykke
        return;
    }

    navigator.geolocation.getCurrentPosition(_onPositionSuccess, _onPositionError, options);
}


// Externe funktioner
window.showConsentBanner = showConsentBanner;                  // bruges af index.html
window.getLastLocation = _loadLocation;                         // bruges af map-manager.js


// Test
// ===========================

// toggle knap i header til testning
function _wireHeaderToggle() {
    const btn = document.getElementById('btn-geo-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
        showConsentBanner(false, true);
    });
}

// Initialisering ved DOM load
function init() {
    createConsentBanner();
    _wireHeaderToggle();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
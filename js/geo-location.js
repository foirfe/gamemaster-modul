/*
 * Geo-location polling module
 * -----------------------------------
 * Purpose: Poll the user's geolocation at a configurable interval (default 2000ms)
 * and provide a small consent/banner UI so polling only begins after explicit
 * user agreement. The implementation avoids repeated browser permission prompts
 * by leveraging the Permissions API when available and by preventing
 * simultaneous prompts.
 *
 * Public usage:
 *  - `startLocationPolling(intervalMs)`        // starts polling if consented
 *  - `stopLocationPolling()`                  // stops polling
 *  - `requestLocationPermission()`            // used by the consent UI to request permission
 *  - `showConsentBanner(showRetry)`           // open the consent banner UI
 *
 * Notes:
 *  - The module exposes backward-compatible wrappers (`showPosition`, etc.)
 *  - The banner UI markup is created dynamically; no styling is required here.
 */

// -----------------------------
// Configuration / Defaults
// -----------------------------
// Default options passed to `getCurrentPosition`.
const CONSENT_STORAGE_KEY = 'geo-consent-state'; // persisted consent flag
const options = {
    enableHighAccuracy: false,
    timeout: 5000,
    maximumAge: 0
};

// -----------------------------
// Internal state
// -----------------------------
// Track internal flags and timers.
let _pollIntervalId = null;
let _userConsented = false;
let _promptInProgress = false;
let _storedConsent = 'unknown';
let _lastLogTs = 0;
let _lastLogCoords = null;

// Load persisted consent (if any) so we know prior user choice.
_storedConsent = _loadConsentState();
if (_storedConsent === 'granted') {
    _userConsented = true;
}

function _loadConsentState() {
    try {
        return localStorage.getItem(CONSENT_STORAGE_KEY) || 'unknown';
    } catch (e) {
        return 'unknown';
    }
}

function _saveConsentState(state) {
    _storedConsent = state;
    try {
        localStorage.setItem(CONSENT_STORAGE_KEY, state);
    } catch (e) {
        // ignore storage failures (private mode, quota, etc.)
    }
}

// -----------------------------
// Position callbacks
// -----------------------------
// Internal handlers for successful / failed `getCurrentPosition` calls.
function _onPositionSuccess(position) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    // Throttle logging: only log if coords change or >3s since last log
    const now = Date.now();
    const coordsChanged = !_lastLogCoords || _lastLogCoords.lat !== latitude || _lastLogCoords.lng !== longitude;
    if (coordsChanged || now - _lastLogTs > 3000) {
        console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);
        _lastLogTs = now;
        _lastLogCoords = { lat: latitude, lng: longitude };
    }
    _userConsented = true;
    _saveConsentState('granted');
}

function _onPositionError(error) {
    console.error(`Error getting geolocation: ${error && error.message}`);
    if (typeof handleError === 'function') handleError(error);
    if (error && error.code === error.PERMISSION_DENIED) {
        // Stop polling immediately and notify the user
        stopLocationPolling();
        _notifyDenied();
    }
}

// -----------------------------
// Polling control & permission handling
// -----------------------------
// Responsible for safely requesting permission (when needed) and starting
// a periodic polling loop. Uses the Permissions API to avoid repeated
// prompts when possible and ensures only one permission prompt is active.
function startLocationPolling(intervalMs = 3000) {
    if (!_userConsented) {
        console.warn('Cannot start polling: user has not consented to share location.');
        return;
    }

    if (!navigator.geolocation) {
        alert('Geolocation is not supported by this browser.');
        return;
    }

    if (_pollIntervalId !== null) return; // already polling

    const beginPolling = () => {
        // single immediate read
        navigator.geolocation.getCurrentPosition(_onPositionSuccess, _onPositionError, options);
        // then periodic reads
        _pollIntervalId = setInterval(() => {
            navigator.geolocation.getCurrentPosition(_onPositionSuccess, _onPositionError, options);
        }, intervalMs);
    };

    // Use Permissions API to avoid repeatedly prompting the user.
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' }).then(status => {
            if (status.state === 'granted') {
                beginPolling();
            } else if (status.state === 'prompt') {
                // Only prompt once and wait for user response
                if (_promptInProgress) return;
                _promptInProgress = true;
                navigator.geolocation.getCurrentPosition(pos => {
                    _promptInProgress = false;
                    _userConsented = true;
                    // start periodic polling now that permission was granted
                    if (_pollIntervalId === null) {
                        _pollIntervalId = setInterval(() => {
                            navigator.geolocation.getCurrentPosition(_onPositionSuccess, _onPositionError, options);
                        }, intervalMs);
                    }
                    _onPositionSuccess(pos);
                }, err => {
                    _promptInProgress = false;
                    if (err && err.code === err.PERMISSION_DENIED) {
                        _notifyDenied();
                    } else {
                        _onPositionError(err);
                    }
                }, options);
            } else { // denied
                _notifyDenied();
            }

            // Listen for permission changes (user may change in browser settings)
            try {
                status.onchange = () => {
                    if (status.state === 'granted' && _pollIntervalId === null) {
                        beginPolling();
                    }
                };
            } catch (e) {
                // some browsers may not allow setting onchange
            }
        }).catch(() => {
            // If permissions.query fails, fallback to a single prompt then polling on success
            if (_promptInProgress) return;
            _promptInProgress = true;
            navigator.geolocation.getCurrentPosition(pos => {
                _promptInProgress = false;
                _userConsented = true;
                beginPolling();
            }, err => {
                _promptInProgress = false;
                if (err && err.code === err.PERMISSION_DENIED) {
                    _notifyDenied();
                } else {
                    _onPositionError(err);
                }
            }, options);
        });
    } else {
        // No Permissions API: ensure we only prompt once, then start polling on success
        if (_promptInProgress) return;
        _promptInProgress = true;
        navigator.geolocation.getCurrentPosition(pos => {
            _promptInProgress = false;
            _userConsented = true;
            beginPolling();
        }, err => {
            _promptInProgress = false;
            if (err && err.code === err.PERMISSION_DENIED) {
                _notifyDenied();
            } else {
                _onPositionError(err);
            }
        }, options);
    }
}

// -----------------------------
// Polling control helpers
// -----------------------------
// Stop the periodic polling loop if one is running.
function stopLocationPolling() {
    if (_pollIntervalId !== null) {
        clearInterval(_pollIntervalId);
        _pollIntervalId = null;
    }
}

// Request permission and start polling if granted. Called from consent UI.
// -----------------------------
// UI-triggered permission request
// -----------------------------
// Called by the consent banner when the user explicitly requests location
// permission (clicks "Allow location"). This marks UI consent, removes the
// banner immediately and delegates to `startLocationPolling` which handles
// prompting safely (using the Permissions API when available).
function requestLocationPermission() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by this browser.');
        return;
    }
    // Mark that the user actively requested permission (UI consent)
    _userConsented = true;
    removeConsentBanner();
    // Delegate to startLocationPolling which will handle prompting safely
    startLocationPolling();
}

// -----------------------------
// Permission denied helper
// -----------------------------
// Notify the user when permission is denied and make the banner available
// for retry or instructions on enabling location access in browser settings.
function _notifyDenied() {
    // Alert the user and ensure there's a persistent UI to retry enabling location
    alert('Location access denied. The app will not function properly without location access.');
    _saveConsentState('denied');
    showConsentBanner(true); // show banner with retry button
}

// Consent banner creation
// -----------------------------
// Consent banner UI
// -----------------------------
// Dynamically creates a small floating banner that asks the user to allow
// or deny location access. Interaction handlers call into the permission
// and polling logic above.
function createConsentBanner() {
    if (document.getElementById('geo-consent-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'geo-consent-banner';
    banner.style.position = 'fixed';
    banner.style.left = '12px';
    banner.style.bottom = '12px';
    banner.style.padding = '12px';
    banner.style.background = '#8D1B3D';
    banner.style.color = '#fff';
    banner.style.borderRadius = '6px';
    banner.style.zIndex = 9999;
    banner.style.maxWidth = '320px';
    banner.style.fontFamily = 'Arial, sans-serif';

    const msg = document.createElement('div');
    msg.id = 'geo-consent-msg';
    msg.textContent = 'Denne app fungerer bedst med adgang til din placering. Tillad adgang?';
    msg.style.marginBottom = '8px';

    const btnAllow = document.createElement('button');
    btnAllow.textContent = 'Tillad placering';
    btnAllow.style.marginRight = '8px';
    // When the user explicitly clicks Allow, hide the banner immediately
    // then request the position. This avoids the banner lingering if
    // the permission prompt delays the success callback.
    btnAllow.onclick = () => {
        _userConsented = true;
        removeConsentBanner();
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by this browser.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => { startLocationPolling(); },
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

    const btnDecline = document.createElement('button');
    btnDecline.textContent = "Afvis placering";
    btnDecline.onclick = () => {
        _userConsented = false;
        stopLocationPolling();
        alert('Du har afvist adgang til placering. Appen fungerer bedst med adgang til placering.');
        _saveConsentState('denied');
        showConsentBanner(true);
    };

    banner.appendChild(msg);
    banner.appendChild(btnAllow);
    banner.appendChild(btnDecline);
    document.body.appendChild(banner);
}

// -----------------------------
// Consent banner helpers
// -----------------------------
// showConsentBanner/removeConsentBanner are used to manage the banner UI
function showConsentBanner(showRetry = false) {
    // Ensure banner exists
    if (!document.getElementById('geo-consent-banner')) createConsentBanner();
    const msg = document.getElementById('geo-consent-msg');
    if (msg) {
        msg.textContent = showRetry
            ? 'Adgang til placering blev tidligere afvist. For at appen kan fungere mere optimalt, skal du tillade adgang til din placering.'
            : 'Denne app fungerer bedst med adgang til din placering. Tillad adgang?';
    }
}

// Remove the consent banner from the DOM.
function removeConsentBanner() {
    const b = document.getElementById('geo-consent-banner');
    if (b && b.parentNode) b.parentNode.removeChild(b);
}

// -----------------------------
// Backward compatibility wrappers
// -----------------------------
// Keep older callback names to avoid breaking other scripts in the app.
function successCallback(position) { _onPositionSuccess(position); }
function errorCallback(error) { _onPositionError(error); }
function showPosition(position) { _onPositionSuccess(position); }
function handleError(error) {
    switch (error && error.code) {
        case error.PERMISSION_DENIED:
            console.error('User denied the request for Geolocation.');
            break;
        case error.POSITION_UNAVAILABLE:
            console.error('Location information is unavailable.');
            break;
        case error.TIMEOUT:
            console.error('The request to get user location timed out.');
            break;
        default:
            console.error('An unknown error: ' + (error && (error.message || error)));
    }
}

// Expose start/stop and request on window for other scripts to call
// -----------------------------
// Public API exposure
// -----------------------------
// Expose the minimal set of helpers that other scripts may use.
window.startLocationPolling = startLocationPolling;
window.stopLocationPolling = stopLocationPolling;
window.requestLocationPermission = requestLocationPermission;
window.showConsentBanner = showConsentBanner;
window.getGeoConsentState = () => _storedConsent;

// -----------------------------
// Initialization & DOM wiring
// -----------------------------
// Create the consent banner after the DOM is ready and wire any
// UI elements (for example `#btn-geo-toggle`) to the banner helpers.
function _wireHeaderToggle() {
    const btn = document.getElementById('btn-geo-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
        if (typeof window.showConsentBanner === 'function') {
            window.showConsentBanner(false);
        } else {
            console.warn('Geo consent helper not available.');
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        createConsentBanner();
        _wireHeaderToggle();
    });
} else {
    createConsentBanner();
    _wireHeaderToggle();
}
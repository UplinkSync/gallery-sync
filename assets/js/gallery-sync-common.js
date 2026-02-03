(function () {
  var admin = (window.GallerySyncAdmin && typeof GallerySyncAdmin === 'object') ? GallerySyncAdmin : {};

  // Returns sanitized plugin settings localized from PHP
  function getSettings() {
    return (window.GallerySyncSettings && typeof GallerySyncSettings === 'object') ? GallerySyncSettings : {};
  }

  // Optional helpers
  function hasLicenseKey() {
    var s = getSettings();
    return !!(s && s.has_license_key);
  }

  function normalizeRestBase(base) {
    if (!base) return '';
    try {
      var url = new URL(base, window.location.origin);
      if (url.origin !== window.location.origin) {
        return url.pathname + url.search;
      }
    } catch (e) {}
    return base;
  }

  function getRestBase(isPro) {
    var base = isPro ? admin.rest_pro : admin.rest;
    return normalizeRestBase(base);
  }

  function getNonce() {
    return admin.nonce || '';
  }

  function getSwUrl() {
    return admin.sw || '';
  }

  async function apiFetch(path, options, isPro) {
    var restBase = getRestBase(!!isPro);
    if (!restBase) {
      throw new Error('REST base URL missing.');
    }

    var opts = options || {};
    var headers = opts.headers || {};
    headers['X-WP-Nonce'] = getNonce();
    opts.headers = headers;

    var response = await fetch(restBase + path, opts);
    if (!response.ok) {
      var text = await response.text();
      var err = new Error('HTTP ' + response.status + ': ' + response.statusText);
      err.status = response.status;
      err.details = text;
      throw err;
    }
    return response.json();
  }

  function initSourceSelector() {
    var grid = document.querySelector('.gallery-sync-source-grid');
    if (!grid) {
      return;
    }

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.gallery-sync-source-card'));
    var radios = Array.prototype.slice.call(grid.querySelectorAll('input[type="radio"][name="source"]'));
    var fields = Array.prototype.slice.call(document.querySelectorAll('.gallery-sync-source-fields'));

    function setSelectedCard(value) {
      cards.forEach(function (card) {
        var isMatch = card.getAttribute('data-source') === value;
        if (isMatch) {
          card.classList.add('is-selected');
        } else {
          card.classList.remove('is-selected');
        }
      });
    }

    function setFieldsVisibility(value) {
      fields.forEach(function (section) {
        var isMatch = section.getAttribute('data-source') === value;
        section.hidden = !isMatch;
        var inputs = section.querySelectorAll('input, select, textarea, button');
        inputs.forEach(function (el) {
          el.disabled = !isMatch;
        });
      });
    }

    function syncSourceUI() {
      var selected = radios.find(function (radio) { return radio.checked; });
      var value = selected ? selected.value : 'immich';
      setSelectedCard(value);
      setFieldsVisibility(value);
    }

    radios.forEach(function (radio) {
      radio.addEventListener('change', syncSourceUI);
    });

    syncSourceUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSourceSelector);
  } else {
    initSourceSelector();
  }

  // Public API
  window.GallerySyncCommon = {
    getSettings: getSettings,
    hasLicenseKey: hasLicenseKey,
    hasApiKey: hasLicenseKey,
    getRestBase: getRestBase,
    getNonce: getNonce,
    getSwUrl: getSwUrl,
    apiFetch: apiFetch,
    initSourceSelector: initSourceSelector
  };
})();

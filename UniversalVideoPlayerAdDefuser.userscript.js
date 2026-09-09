// ==UserScript==
// @name         Universal Video Player Ad Defuser (Debug Edition)
// @namespace    local.shield.videodefuser.debug
// @version      2.2.0-debug
// @description  Defuses video ads, embeds an on-screen debug console (Eruda), and logs all intercepted ad calls.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @author       gatornotade
// ==/UserScript==

(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  /* =========================================================================
   * 0. ON-SCREEN MOBILE DEVTOOLS (ERUDA LOADER)
   * ========================================================================= */
  const initEruda = () => {
    if (window.eruda) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.onload = () => {
      if (window.eruda) {
        window.eruda.init({
          tool: ['console', 'network', 'elements', 'resources']
        });
        console.log('%c[Defuser Debug]%c Eruda Mobile Console Initialized', 'background: #008080; color: #fff; font-weight: bold; padding: 2px 5px;', '');
      }
    };
    (document.head || document.documentElement).appendChild(script);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEruda);
  } else {
    initEruda();
  }

  const logDefuse = (type, detail) => {
    console.log(
      `%c[AdDefuser :: ${type}]%c ${detail}`,
      'background: #d9534f; color: #fff; font-weight: bold; padding: 2px 4px; border-radius: 2px;',
      'color: #d9534f; font-weight: bold;'
    );
  };

  /* =========================================================================
   * 1. GOOGLE IMA SDK COMPATIBILITY STUB
   * ========================================================================= */
  function createImaMock() {
    function MockManager() {
      this.init = function () {};
      this.start = function () {};
      this.stop = function () {};
      this.destroy = function () {};
      this.discardAdBreak = function () {};
      this.getRemainingTime = function () { return 0; };
      this.getVolume = function () { return 1; };
      this.getCuePoints = function () { return []; };
      this.addEventListener = function (evt, cb) {
        if (evt === 'allAdsCompleted' || evt === 'adError' || evt === 'contentResumeRequested') {
          setTimeout(() => {
            try {
              logDefuse('IMA Event Emitted', evt);
              cb({ type: evt, getAd: () => null, getAdData: () => ({}) });
            } catch (_) {}
          }, 10);
        }
      };
      this.removeEventListener = function () {};
    }

    return {
      AdDisplayContainer: function () {
        this.initialize = function () {};
        this.destroy = function () {};
      },
      AdsLoader: function () {
        this.contentComplete = function () {};
        this.requestAds = function () {
          logDefuse('IMA SDK', 'AdsLoader.requestAds() intercepted & suppressed');
        };
        this.destroy = function () {};
        this.addEventListener = function (evt, cb) {
          if (evt === 'adsManagerLoaded') {
            setTimeout(() => {
              try {
                logDefuse('IMA Event Emitted', evt);
                cb({ getAdsManager: () => new MockManager(), getUserRequestContext: () => ({}) });
              } catch (_) {}
            }, 10);
          } else if (evt === 'adError') {
            setTimeout(() => {
              try {
                logDefuse('IMA Event Emitted', evt);
                cb({ getError: () => ({ getMessage: () => 'Defused', getErrorCode: () => 0 }) });
              } catch (_) {}
            }, 10);
          }
        };
        this.removeEventListener = function () {};
      },
      AdsRenderingSettings: function () {},
      AdsRequest: function () {},
      ViewMode: { NORMAL: 'normal', FULLSCREEN: 'fullscreen' },
      AdError: { Type: {} },
      AdEvent: { Type: { ALL_ADS_COMPLETED: 'allAdsCompleted', CONTENT_RESUME_REQUESTED: 'contentResumeRequested' } }
    };
  }

  let _google = window.google;
  const _imaStub = createImaMock();
  Object.defineProperty(window, 'google', {
    configurable: true,
    enumerable: true,
    get: () => {
      if (!_google) _google = {};
      if (!_google.ima) {
        logDefuse('IMA Hook', 'window.google.ima stub instantiated');
        _google.ima = _imaStub;
      }
      return _google;
    },
    set: (val) => {
      _google = val || {};
      try {
        if (!_google.ima) _google.ima = _imaStub;
      } catch (_) {}
    }
  });

  /* =========================================================================
   * 2. VAST NETWORK INTERCEPTION
   * ========================================================================= */
  const EMPTY_VAST_XML = '<?xml version="1.0" encoding="UTF-8"?><VAST version="3.0"/>';
  const VAST_TAG_REGEX = /(?:imasdk\.googleapis\.com|\/vast[\/?]|\/vpaid[\/?]|pagead\/.*video)/i;
  const MEDIA_CHUNK_REGEX = /\.(m3u8|mpd|ts|m4s|mp4|webm)(\?.*)?$/i;

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (url && VAST_TAG_REGEX.test(url) && !MEDIA_CHUNK_REGEX.test(url)) {
      logDefuse('Fetch Intercept', url);
      return Promise.resolve(new Response(EMPTY_VAST_XML, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      }));
    }
    return origFetch.apply(this, arguments);
  };

  const origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._v_url = typeof url === 'string' ? url : '';
    return origXhrOpen.apply(this, arguments);
  };

  const origXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    const targetUrl = this._v_url || '';
    if (targetUrl && VAST_TAG_REGEX.test(targetUrl) && !MEDIA_CHUNK_REGEX.test(targetUrl)) {
      logDefuse('XHR Intercept', targetUrl);
      Object.defineProperty(this, 'status', { value: 200 });
      Object.defineProperty(this, 'readyState', { value: 4 });
      Object.defineProperty(this, 'responseText', { value: EMPTY_VAST_XML });
      Object.defineProperty(this, 'response', { value: EMPTY_VAST_XML });
      setTimeout(() => {
        this.dispatchEvent(new Event('readystatechange'));
        this.dispatchEvent(new Event('load'));
      }, 0);
      return;
    }
    return origXhrSend.apply(this, arguments);
  };

  /* =========================================================================
   * 3. SKIP CLICKER & AD CONTAINER SPEED-UP
   * ========================================================================= */
  const SKIP_WORDS = ['skip', 'saltar', 'ignorar', 'omitir', 'passer'];

  setInterval(() => {
    const buttons = document.querySelectorAll('button, [role="button"], div, a');
    for (const btn of buttons) {
      const txt = (btn.textContent || '').trim().toLowerCase();
      if (txt.length > 0 && txt.length < 25 && SKIP_WORDS.some(w => txt.includes(w))) {
        if (btn.offsetParent !== null) {
          logDefuse('Skip Button Clicked', `Text: "${txt}"`);
          try { btn.click(); } catch (_) {}
        }
      }
    }

    const adContainers = document.querySelectorAll('.ad-showing, .video-ads, .ima-ad-container, [class*="preroll-container"]');
    adContainers.forEach(container => {
      const v = container.querySelector('video');
      if (v && !v.dataset.defused) {
        logDefuse('Fast-Forward Ad Video', `Current time: ${v.currentTime}s, Duration: ${v.duration}s`);
        try {
          v.muted = true;
          v.playbackRate = 16.0;
          if (Number.isFinite(v.duration) && v.duration > 0) {
            v.currentTime = v.duration - 0.1;
          }
          v.dataset.defused = 'true';
        } catch (_) {}
      }
    });
  }, 500);
})();

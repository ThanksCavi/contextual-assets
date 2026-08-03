/**
 * Lottie Mask Component
 * ---------------------
 * Finds every [data-lottie-mask] element, builds the dual-Lottie SVG mask
 * structure inside it, and plays once when the element enters the viewport.
 *
 * Required data-attributes on each container:
 *   data-lottie-mask    – marker (value ignored)
 *   data-lottie-img-1   – URL to first image
 *   data-lottie-img-2   – URL to second image
 *   data-lottie-img-3   – URL to third image (also used as placeholder / fallback)
 *
 * Optional:
 *   data-lottie-img-4   – URL to fourth image; when present, replays the 1→2
 *                         transition once more so four images appear in sequence.
 *                         3-image instances are unaffected. Empty/whitespace is
 *                         treated as absent (safe with Webflow CMS empty fields).
 *   data-lottie-preset  – named animation preset ("single"). Selects a different
 *                         Lottie asset and its own fade timing; only
 *                         data-lottie-img-1 is used. Absent or unknown value
 *                         falls back to the default 3/4-image behaviour.
 *
 * Dependencies: lottie-web (bodymovin) must be loaded before this script.
 *
 * Supports multiple independent instances on one page.
 */
(function lottieMaskInit() {
  'use strict';

  var DEFAULT_JSON_URL = 'https://cdn.prod.website-files.com/69dfe91a819e76a918bef68c/69fbd229cc2222b87f7ebc15_introscreen-updated.json';
  var VIEW_BOX = '0 0 900 900';
  var SVG_NS   = 'http://www.w3.org/2000/svg';
  var XLINK_NS = 'http://www.w3.org/1999/xlink';
  // Fixed image slot for the current Lottie asset's largest circular reveal.
  var IMAGE_FRAME = {
    x: '228.25',
    y: '228.25',
    width: '443.5',
    height: '443.5'
  };
  var FADE_RULES = [
    { idx: 0, inStart:  79, inEnd:  90, outStart: 120, outEnd: 140 },
    { idx: 1, inStart: 140, inEnd: 165, outStart: 207, outEnd: 234 },
    { idx: 2, inStart: 234, inEnd: 256, outStart: Infinity, outEnd: Infinity }
  ];

  // Segment splice constants for 4-image mode.
  // Frames 100 and 266 are pixel-identical in the Lottie asset (0-channel diff verified).
  // Playing [0, 266] then [100, 186] gives T1 anticlockwise → T2 clockwise → T1 anticlockwise.
  var SEG_A    = 100; // jump-to frame (start of T1 steady zone)
  var SEG_B    = 266; // jump-from frame (end of T2 steady zone, pixel-identical to SEG_A)
  var SEG_TAIL = 186; // end of replay segment (just past T1 transition)
  var REPEAT_OFFSET = SEG_B - SEG_A; // 166 — added to actual frame to get virtual frame in segment 2

  // Virtual-timeline fade rules for 4-image mode (total virtual length = 266 + 86 = 352 frames).
  // img1/img2 windows are the same as the 3-image FADE_RULES (T1 + T2 play in full first).
  // img3 out and img4 in are the original T1 windows + REPEAT_OFFSET (166).
  var FADE_RULES_4 = [
    { idx: 0, inStart:  79, inEnd:  90, outStart: 120, outEnd: 140 },
    { idx: 1, inStart: 140, inEnd: 165, outStart: 207, outEnd: 234 },
    { idx: 2, inStart: 234, inEnd: 256, outStart: 286, outEnd: 306 },
    { idx: 3, inStart: 306, inEnd: 331, outStart: Infinity, outEnd: Infinity }
  ];

  // Named presets. A different Lottie asset needs its own fade timing, so the
  // asset URL, start frame and rules live together.
  // "single" = careers-morph.json — frames 120..180 of the default asset re-timed
  // to 24 fps (60 frames, 2.5s). One image, revealed through the morphing mask.
  // startFrame 9: frames 0-8 still carry the asset's blue ring and black disc,
  // which the default asset hides behind an already-opaque image. Starting at 9
  // keeps them off screen so the image can fade up from nothing.
  var PRESETS = {
    single: {
      jsonUrl: 'https://cdn.prod.website-files.com/69dfe91a819e76a918bef68c/6a70e9fa5931481ce9a7e9cb_careers-morph.json',
      startFrame: 9,
      rules: [
        { idx: 0, inStart: 9, inEnd: 21, outStart: Infinity, outEnd: Infinity }
      ]
    }
  };

  var IO_THRESHOLD = 0.15;

  var jsonCache = {};
  var instanceCount = 0;

  function getOpacity(frame, rule) {
    if (frame < rule.inStart)  return 0;
    if (frame < rule.inEnd)    return (frame - rule.inStart) / (rule.inEnd - rule.inStart);
    if (frame < rule.outStart) return 1;
    if (frame < rule.outEnd)   return 1 - (frame - rule.outStart) / (rule.outEnd - rule.outStart);
    return 0;
  }

  function setImageHref(imageEl, url) {
    imageEl.setAttribute('href', url);
    imageEl.setAttributeNS(XLINK_NS, 'xlink:href', url);
  }

  function createSvgElement(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function(key) {
        el.setAttribute(key, attrs[key]);
      });
    }
    return el;
  }

  function createDiv(className) {
    var div = document.createElement('div');
    div.className = className;
    return div;
  }

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function getPlaceholder(container) {
    return container.querySelector('.lottie-builder-placeholder');
  }

  function getPlaceholderImage(placeholder) {
    if (!placeholder) return null;
    if (placeholder.tagName === 'IMG') return placeholder;
    return placeholder.querySelector('img');
  }

  function ensurePlaceholder(container, fallbackUrl) {
    var placeholder = getPlaceholder(container);

    if (!placeholder && fallbackUrl) {
      placeholder = document.createElement('img');
      placeholder.className = 'lottie-builder-placeholder';
      placeholder.alt = '';
      placeholder.loading = 'lazy';
      container.insertBefore(placeholder, container.firstChild);
    }

    if (placeholder && fallbackUrl) {
      var placeholderImage = getPlaceholderImage(placeholder);

      if (placeholderImage) {
        if (placeholder !== placeholderImage) {
          placeholder.style.backgroundImage = 'none';
        }
        if (!placeholderImage.getAttribute('src')) placeholderImage.setAttribute('src', fallbackUrl);
      } else if (placeholder.tagName === 'IMG') {
        if (!placeholder.getAttribute('src')) placeholder.setAttribute('src', fallbackUrl);
      } else {
        placeholder.style.backgroundImage = 'none';
      }
    }

    return placeholder;
  }

  function showStaticFallback(container, config, state) {
    var placeholder = ensurePlaceholder(container, config.fallbackUrl);
    var animatedLayers = container.querySelectorAll('.lm-stage, .lm-visible');

    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.style.visibility = 'visible';
    }

    animatedLayers.forEach(function(layer) {
      layer.style.display = 'none';
    });

    container.setAttribute('data-lottie-mask-ready', state || 'static');
  }

  function hideStaticFallback(container) {
    var placeholder = getPlaceholder(container);
    var animatedLayers = container.querySelectorAll('.lm-stage, .lm-visible');

    if (placeholder) placeholder.style.display = 'none';

    animatedLayers.forEach(function(layer) {
      layer.style.display = '';
    });
  }

  function fetchJson(url) {
    if (jsonCache[url]) return jsonCache[url];
    jsonCache[url] = fetch(url)
      .then(function(res) {
        if (!res.ok) throw new Error('Lottie JSON fetch failed: ' + res.status);
        return res.json();
      });
    return jsonCache[url];
  }

  function readConfig(container, index) {
    var preset = PRESETS[(container.getAttribute('data-lottie-preset') || '').trim()];

    if (preset) {
      var img1 = container.getAttribute('data-lottie-img-1');

      if (!img1) {
        console.warn('[lottie-mask] Missing data-lottie-img-1 on preset instance', index);
      }

      return {
        jsonUrl: preset.jsonUrl,
        imgUrls: [img1],
        fallbackUrl: img1,
        repeatMode: false,
        startFrame: preset.startFrame || 0,
        rules: preset.rules
      };
    }

    var img4 = (container.getAttribute('data-lottie-img-4') || '').trim();
    var imgUrls = [
      container.getAttribute('data-lottie-img-1'),
      container.getAttribute('data-lottie-img-2'),
      container.getAttribute('data-lottie-img-3')
    ];

    if (img4) imgUrls.push(img4);

    if (!imgUrls[2]) {
      console.warn('[lottie-mask] Missing data-lottie-img-3 fallback on instance', index);
    }

    return {
      jsonUrl: DEFAULT_JSON_URL,
      imgUrls: imgUrls,
      fallbackUrl: img4 || imgUrls[2],
      repeatMode: !!img4,
      startFrame: 0,
      rules: img4 ? FADE_RULES_4 : FADE_RULES
    };
  }

  function buildDOM(container, imgUrls) {
    var maskId = 'lm-mask-' + (++instanceCount);

    var visibleDiv = createDiv('lm-visible');

    var svgStage = createSvgElement('svg', {
      'class':                'lm-stage',
      'viewBox':              VIEW_BOX,
      'preserveAspectRatio':  'xMidYMid slice',
      'xmlns':                SVG_NS
    });
    svgStage.setAttribute('aria-hidden', 'true');
    svgStage.setAttribute('focusable', 'false');

    var defs = createSvgElement('defs');
    var mask = createSvgElement('mask', {
      'id':                   maskId,
      'class':                'lm-mask-alpha',
      'mask-type':            'alpha',
      'maskUnits':            'userSpaceOnUse',
      'maskContentUnits':     'userSpaceOnUse',
      'x': '0', 'y': '0', 'width': '900', 'height': '900'
    });
    defs.appendChild(mask);
    svgStage.appendChild(defs);

    var imageEls = [];
    for (var i = 0; i < imgUrls.length; i++) {
      var img = createSvgElement('image', {
        'x': IMAGE_FRAME.x,
        'y': IMAGE_FRAME.y,
        'width': IMAGE_FRAME.width,
        'height': IMAGE_FRAME.height,
        'preserveAspectRatio': 'xMidYMid slice',
        'mask':    'url(#' + maskId + ')',
        'opacity': '0'
      });
      if (imgUrls[i]) setImageHref(img, imgUrls[i]);
      svgStage.appendChild(img);
      imageEls.push(img);
    }

    var maskSourceDiv = createDiv('lm-mask-source');

    container.appendChild(svgStage);
    container.appendChild(visibleDiv);
    container.appendChild(maskSourceDiv);

    return {
      visibleDiv:     visibleDiv,
      maskSourceDiv:  maskSourceDiv,
      maskEl:         mask,
      imageEls:       imageEls
    };
  }

  function moveMaskGroups(parts) {
    var sourceSvg = parts.maskSourceDiv.querySelector('svg');
    if (!sourceSvg) return false;

    var groups = Array.prototype.filter.call(sourceSvg.children, function(child) {
      return child.localName === 'g';
    });

    groups.forEach(function(group) {
      group.removeAttribute('clip-path');
      parts.maskEl.appendChild(group);
    });

    return groups.length > 0;
  }

  function initLottie(container, config) {
    fetchJson(config.jsonUrl).then(function(data) {
      if (typeof lottie === 'undefined') {
        console.error('[lottie-mask] lottie-web (bodymovin) is not loaded.');
        showStaticFallback(container, config, 'static');
        return;
      }

      if (!data.layers || !data.layers.length) {
        console.warn('[lottie-mask] Lottie JSON has no layers. Leaving fallback image visible.');
        showStaticFallback(container, config, 'error');
        return;
      }

      var parts = buildDOM(container, config.imgUrls);

      var visibleData = cloneData(data);

      var visibleAnim = lottie.loadAnimation({
        container: parts.visibleDiv,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData: visibleData,
        rendererSettings: { preserveAspectRatio: 'xMidYMid slice' }
      });

      var maskData = cloneData(data);

      var maskAnim = lottie.loadAnimation({
        container: parts.maskSourceDiv,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData: maskData,
        rendererSettings: { preserveAspectRatio: 'xMidYMid slice' }
      });

      var visibleReady = false;
      var maskReady = false;

      function startPlaybackWhenReady() {
        if (!visibleReady || !maskReady) return;

        hideStaticFallback(container);
        container.setAttribute('data-lottie-mask-ready', 'playing');
        visibleAnim.goToAndStop(config.startFrame, true);
        maskAnim.goToAndStop(config.startFrame, true);

        if (config.repeatMode) {
          visibleAnim.playSegments([[0, SEG_B], [SEG_A, SEG_TAIL]], true);
        } else if (config.startFrame) {
          visibleAnim.playSegments([[config.startFrame, visibleAnim.totalFrames]], true);
        } else {
          visibleAnim.play();
        }
      }

      visibleAnim.addEventListener('DOMLoaded', function() {
        visibleReady = true;
        startPlaybackWhenReady();
      });

      maskAnim.addEventListener('DOMLoaded', function() {
        maskReady = moveMaskGroups(parts);
        if (!maskReady) {
          showStaticFallback(container, config, 'error');
          console.warn('[lottie-mask] Mask SVG groups were not found.');
          return;
        }

        startPlaybackWhenReady();
      });

      if (config.repeatMode) {
        visibleAnim.addEventListener('enterFrame', function(e) {
          // firstFrame is 0 in segment 1, SEG_A in segment 2.
          var actual = visibleAnim.firstFrame + e.currentTime;
          var virtual = actual + (visibleAnim.firstFrame > 0 ? REPEAT_OFFSET : 0);

          maskAnim.goToAndStop(actual, true);

          for (var i = 0; i < config.rules.length; i++) {
            var rule = config.rules[i];
            if (parts.imageEls[i]) {
              parts.imageEls[i].setAttribute('opacity', getOpacity(virtual, rule).toFixed(3));
            }
          }
        });
      } else {
        visibleAnim.addEventListener('enterFrame', function(e) {
          // firstFrame is 0 for a plain play(), or startFrame when a segment is used.
          var f = visibleAnim.firstFrame + e.currentTime;
          maskAnim.goToAndStop(f, true);

          for (var i = 0; i < config.rules.length; i++) {
            var rule = config.rules[i];
            if (parts.imageEls[i]) {
              parts.imageEls[i].setAttribute('opacity', getOpacity(f, rule).toFixed(3));
            }
          }
        });
      }
    }).catch(function(err) {
      showStaticFallback(container, config, 'error');
      console.error('[lottie-mask] Init failed:', err);
    });
  }

  function main() {
    var containers = document.querySelectorAll('[data-lottie-mask]');
    if (!containers.length) return;

    var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    containers.forEach(function(container, index) {
      if (container.hasAttribute('data-lottie-mask-ready')) return;

      var config = readConfig(container, index);
      if (!config) return;
      ensurePlaceholder(container, config.fallbackUrl);

      if (prefersReducedMotion) {
        showStaticFallback(container, config, 'static');
        return;
      }

      if (typeof lottie === 'undefined') {
        console.error('[lottie-mask] lottie-web (bodymovin) must be loaded before lottie-mask.js');
        showStaticFallback(container, config, 'static');
        return;
      }

      function start() {
        if (container.getAttribute('data-lottie-mask-ready') !== 'pending') return;
        initLottie(container, config);
      }

      container.setAttribute('data-lottie-mask-ready', 'pending');

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              observer.unobserve(container);
              start();
            }
          });
        }, { threshold: IO_THRESHOLD });

        observer.observe(container);
      } else {
        start();
      }
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    main();
  } else {
    window.addEventListener('DOMContentLoaded', main);
  }
})();

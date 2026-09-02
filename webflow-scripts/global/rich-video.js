/*
 * Rich-text video: превью + кнопка play вместо YouTube/Vimeo iframe'ов.
 * Раньше жил инлайном в Site Settings → Custom code → Footer; вынесен сюда 02.09.2026.
 * Стили классов .rich-video / .rich-video-thumb / .rich-video-play — в global/global.css
 * (раздел RICH TEXT VIDEO). Подключение: <script src=".../global/rich-video.js?v=1&build=<sha>">.
 */
document.addEventListener('DOMContentLoaded', () => {
  const VIDEO_IFRAME_SELECTOR = [
    'iframe[src*="youtube.com"]',
    'iframe[src*="youtu.be"]',
    'iframe[src*="vimeo.com"]',
    'iframe[src*="player.vimeo.com"]',
    'iframe[src*="embedly.com/widgets/media.html"]'
  ].join(',');

  const iframes = document.querySelectorAll(VIDEO_IFRAME_SELECTOR);

  iframes.forEach((iframe) => {
    if (iframe.closest('.rich-video')) return;
    if (iframe.dataset.richVideoProcessed === 'true') return;

    iframe.dataset.richVideoProcessed = 'true';

    const originalSrc = iframe.getAttribute('src');
    const cleanSrc = getCleanVideoSrc(originalSrc);

    const videoData = getVideoData(cleanSrc);

    if (!videoData) return;

    const { type, videoId, thumbUrl, fallbackThumbUrl } = videoData;

    const wrapper = document.createElement('div');
    wrapper.classList.add('rich-video');

    const thumb = document.createElement('div');
    thumb.classList.add('rich-video-thumb');
    thumb.style.backgroundImage = `url("${thumbUrl}")`;

    const play = document.createElement('div');
    play.classList.add('rich-video-play');

    wrapper.appendChild(thumb);
    wrapper.appendChild(play);

    iframe.parentNode.insertBefore(wrapper, iframe);
    iframe.remove();

    if (type === 'youtube' && fallbackThumbUrl) {
      const testImg = new Image();

      testImg.onload = () => {
        if (testImg.width < 500) {
          thumb.style.backgroundImage = `url("${fallbackThumbUrl}")`;
        }
      };

      testImg.onerror = () => {
        thumb.style.backgroundImage = `url("${fallbackThumbUrl}")`;
      };

      testImg.src = thumbUrl;
    }

    if (type === 'vimeo') {
      fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`)
        .then((response) => {
          if (!response.ok) return null;
          return response.json();
        })
        .then((data) => {
          if (data && data.thumbnail_url) {
            thumb.style.backgroundImage = `url("${data.thumbnail_url}")`;
          }
        })
        .catch(() => {});
    }

    wrapper.addEventListener('click', () => {
      const newIframe = document.createElement('iframe');

      if (type === 'youtube') {
        newIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        newIframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      }

      if (type === 'vimeo') {
        newIframe.src = `https://player.vimeo.com/video/${videoId}?autoplay=1`;
        newIframe.allow = 'autoplay; fullscreen; picture-in-picture';
      }

      newIframe.setAttribute('frameborder', '0');
      newIframe.setAttribute('allowfullscreen', '');
      newIframe.allowFullscreen = true;

      wrapper.innerHTML = '';
      wrapper.appendChild(newIframe);
    });
  });

  function getCleanVideoSrc(src) {
    if (!src) return '';

    const absoluteSrc = src.startsWith('//') ? `${window.location.protocol}${src}` : src;

    if (!absoluteSrc.includes('embedly.com/widgets/media.html')) {
      return absoluteSrc;
    }

    try {
      const url = new URL(absoluteSrc, window.location.href);
      const embeddedSrc = url.searchParams.get('src') || url.searchParams.get('url');

      return embeddedSrc ? decodeURIComponent(embeddedSrc) : absoluteSrc;
    } catch (error) {
      return absoluteSrc;
    }
  }

  function getVideoData(src) {
    if (!src) return null;

    const youtubeId = getYoutubeId(src);

    if (youtubeId) {
      return {
        type: 'youtube',
        videoId: youtubeId,
        thumbUrl: `https://i.ytimg.com/vi_webp/${youtubeId}/maxresdefault.webp`,
        fallbackThumbUrl: `https://i.ytimg.com/vi_webp/${youtubeId}/hqdefault.webp`
      };
    }

    const vimeoId = getVimeoId(src);

    if (vimeoId) {
      return {
        type: 'vimeo',
        videoId: vimeoId,
        thumbUrl: '', // превью Vimeo приходит из oEmbed ниже; via.placeholder.com мёртв
        fallbackThumbUrl: ''
      };
    }

    return null;
  }

  function getYoutubeId(src) {
    const patterns = [
      /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
      /youtu\.be\/([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
      const match = src.match(pattern);
      if (match && match[1]) return match[1];
    }

    try {
      const url = new URL(src, window.location.href);
      return url.searchParams.get('v');
    } catch (error) {
      return null;
    }
  }

  function getVimeoId(src) {
    const patterns = [
      /player\.vimeo\.com\/video\/(\d+)/,
      /vimeo\.com\/video\/(\d+)/,
      /vimeo\.com\/(\d+)/
    ];

    for (const pattern of patterns) {
      const match = src.match(pattern);
      if (match && match[1]) return match[1];
    }

    return null;
  }
});

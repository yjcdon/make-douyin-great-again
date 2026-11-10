(() => {
    'use strict';

    const preference = 'disableHoverPreview';
    const cardSelector = '.discover-video-card-item';
    const moreSelector = '._6D1Cp2t';
    let enabled = true;
    let preferenceChanged = false;

    function onJingxuanList() {
        return /^\/jingxuan\/?$/.test(location.pathname) && !new URLSearchParams(location.search).has('modal_id');
    }

    function suppressHover(event) {
        if (!enabled || !onJingxuanList()) return;
        // 移出事件的目标节点也能让 React 为下一张卡片触发进入事件。
        const leaving = event.type.endsWith('out');
        const destination = leaving ? event.relatedTarget : event.target;
        if (!(destination instanceof Element)) return;
        const card = destination.closest(cardSelector);
        if (!card || destination.closest(moreSelector)) return;
        if (leaving && event.target instanceof Element && event.target.closest(moreSelector)?.closest(cardSelector) === card) return;
        event.stopPropagation();
    }

    function stopPreview(event) {
        const video = event.target;
        if (enabled && onJingxuanList() && video instanceof HTMLVideoElement && video.closest(cardSelector)) {
            video.pause();
        }
    }

    for (const type of ['pointerover', 'pointerenter', 'pointerout', 'mouseover', 'mouseenter', 'mouseout']) {
        window.addEventListener(type, suppressHover, true);
    }
    window.addEventListener('play', stopPreview, true);

    function updatePreviewStyle() {
        document.documentElement?.classList.toggle('mdga-disable-hover-preview', enabled);
    }

    document.addEventListener('DOMContentLoaded', updatePreviewStyle, { once: true });
    chrome.storage.local.onChanged.addListener((changes) => {
        if (!changes[preference]) return;
        preferenceChanged = true;
        enabled = changes[preference].newValue !== false;
        updatePreviewStyle();
        if (enabled && onJingxuanList()) {
            for (const video of document.querySelectorAll(`${cardSelector} video`)) {
                if (video.paused && !video.matches(`${cardSelector}:hover video`)) continue;
                // 切换开关时，先让已打开的预览执行站点的离开处理。
                video.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse' }));
                video.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
                if (!video.paused) video.pause();
            }
        }
    });
    chrome.storage.local.get({ [preference]: true }).then((settings) => {
        if (!preferenceChanged) enabled = settings[preference] !== false;
        updatePreviewStyle();
    }).catch((error) => console.warn('读取悬浮浏览设置失败', error));
})();

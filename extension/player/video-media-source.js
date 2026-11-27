(() => {
    'use strict';

    /** 从当前作品信息组件读取站点已经提供的整段播放地址。 */
    document.addEventListener('mdga-request-video-source', (event) => {
        const info = event.target;
        if (!(info instanceof HTMLElement) || !info.matches('[data-e2e="video-info"], [data-e2e="detail-video-info"]')) return;
        const fiberKey = Object.keys(info).find((key) => key.startsWith('__reactFiber$'));
        for (let fiber = info[fiberKey]; fiber; fiber = fiber.return) {
            const aweme = fiber.memoizedProps?.awemeInfo;
            if (aweme?.awemeId !== event.detail) continue;
            const source = aweme.video?.playApi
                || aweme.video?.playAddr?.find((entry) => typeof entry?.src === 'string')?.src;
            if (source) info.dispatchEvent(new CustomEvent('mdga-video-source', { detail: source }));
            break;
        }
    });
})();

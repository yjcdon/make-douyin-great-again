(() => {
    'use strict';

    const cardSelector = '.discover-video-card-item';
    const coverSelector = '.videoImage';
    const playerSelector = '.xgplayer, video';
    const surfaceSelector = `${coverSelector}, ${playerSelector}`;
    const hiddenClass = 'mdga-featured-player-hidden';
    const gridClass = 'mdga-featured-cover-grid';
    const pendingClass = 'mdga-jingxuan-layout-pending';
    const jingxuanPath = /^\/jingxuan\/?$/;
    let featured;
    let grid;
    let waitingForLayout = true;
    let revealTimer;

    function onJingxuanList() {
        return jingxuanPath.test(location.pathname) && !new URLSearchParams(location.search).has('modal_id');
    }

    function stillHasFeaturedCover() {
        return featured?.isConnected && (featured.matches(surfaceSelector) || featured.querySelector(surfaceSelector));
    }

    function revealLayout() {
        clearTimeout(revealTimer);
        revealTimer = undefined;
        waitingForLayout = false;
        document.documentElement.classList.remove(pendingClass);
    }

    function releaseMedia() {
        const videos = featured.matches('video') ? [featured] : featured.querySelectorAll('video');
        for (const video of videos) {
            if (!video.paused) video.pause();
            video.removeAttribute('autoplay');
            video.removeAttribute('poster');
            const sources = video.querySelectorAll('source[src]');
            if (!video.hasAttribute('src') && !video.srcObject && !sources.length) continue;
            video.removeAttribute('src');
            if (video.srcObject) video.srcObject = null;
            for (const source of sources) source.removeAttribute('src');
            video.load();
        }
    }

    const mediaObserver = new MutationObserver(releaseMedia);

    function clearFeaturedLayout() {
        if (!featured) return;
        mediaObserver.disconnect();
        featured.removeEventListener('loadstart', releaseMedia, true);
        featured.classList.remove(hiddenClass);
        grid.classList.remove(gridClass);
        grid.style.removeProperty('--mdga-cover-min-width');
        featured = grid = undefined;
    }

    function waitForLayout() {
        if (waitingForLayout && !revealTimer && document.querySelector(cardSelector)) {
            // 单列或仅有一张卡时，保留可用的原生布局。
            revealTimer = setTimeout(revealLayout, 1200);
        }
    }

    function measure(element) {
        return { element, rect: element.getBoundingClientRect() };
    }

    function refreshLayout() {
        const root = document.documentElement;
        if (!root) return;
        if (!onJingxuanList()) {
            revealLayout();
            waitingForLayout = true;
            if (!jingxuanPath.test(location.pathname)) clearFeaturedLayout();
            return;
        }
        if (stillHasFeaturedCover()) return;
        if (waitingForLayout) root.classList.add(pendingClass);
        clearFeaturedLayout();

        const surfaces = [...document.querySelectorAll(coverSelector)].slice(0, 12).map(measure)
            .filter(({ rect }) => rect.width && rect.height);
        const covers = surfaces.filter(({ element }) => element.closest(cardSelector));
        if (!covers.length) {
            waitForLayout();
            return;
        }
        const top = Math.min(...covers.map(({ rect }) => rect.top));
        const firstRow = covers.filter(({ rect }) => Math.abs(rect.top - top) <= 8);

        // 大卡先渲染静态封面，播放器可能稍后才挂载。
        const players = Array.from(document.querySelectorAll(playerSelector), measure);
        for (const { element: surface, rect } of [...surfaces, ...players]) {
            if (Math.abs(rect.top - top) > 8) continue;
            const right = firstRow.find(({ rect: cover }) => cover.left >= rect.right - 8
                && Math.abs(cover.top - rect.top) <= 8
                && rect.width >= 1.8 * cover.width && rect.height >= 1.6 * cover.height);
            if (!right) continue;

            // 只隐藏大卡所在的分支，右侧和下方的普通封面仍由抖音管理。
            let item = surface;
            while (item.parentElement && !item.parentElement.contains(right.element)) item = item.parentElement;
            const row = item.parentElement;
            if (!row || row === document.body || row === document.documentElement) continue;
            const below = covers.find(({ rect: cover }) => Math.abs(cover.left - rect.left) <= 8
                && cover.top >= rect.bottom - 8 && !item.contains(cover.element));
            let list = row;
            while (below && !list.contains(below.element)) list = list.parentElement;
            if (list === document.body || list === document.documentElement) continue;

            featured = item;
            grid = list;
            featured.classList.add(hiddenClass);
            grid.style.setProperty('--mdga-cover-min-width', `${Math.floor(right.rect.width * 0.9)}px`);
            grid.classList.add(gridClass);
            releaseMedia();
            // srcObject 更新不会产生属性变更，由大卡自己的媒体事件补充处理。
            featured.addEventListener('loadstart', releaseMedia, true);
            mediaObserver.observe(featured, {
                subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'poster', 'autoplay'],
            });
            break;
        }
        if (featured || firstRow.length >= 2) revealLayout();
        else waitForLayout();
    }

    const layoutSelector = `${cardSelector}, ${surfaceSelector}`;
    new MutationObserver((records) => {
        if (!onJingxuanList() || stillHasFeaturedCover()) return;
        if (waitingForLayout || records.some(({ addedNodes, removedNodes }) =>
            [...addedNodes, ...removedNodes].some((node) => node instanceof Element
                && (node.matches(layoutSelector) || node.querySelector(layoutSelector))))) {
            refreshLayout();
        }
    }).observe(document, { subtree: true, childList: true });
    window.addEventListener('resize', refreshLayout);
    document.addEventListener('load', (event) => {
        if (onJingxuanList() && (waitingForLayout || event.target.matches?.('link[rel="stylesheet"]'))) {
            refreshLayout();
        }
    }, true);
    window.navigation?.addEventListener('navigatesuccess', refreshLayout);
    refreshLayout();
})();

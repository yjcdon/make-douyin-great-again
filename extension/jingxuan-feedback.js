(() => {
    'use strict';

    const cardSelector = '.discover-video-card-item';
    const workReferences = 'a[href*="/video/"], a[href*="/note/"], a[href*="modal_id="], [data-aweme-id]';
    const coverClass = 'mdga-feedback-cover';
    const moreSelector = '._6D1Cp2t';
    const openMoreSelector = moreSelector + '.YK5tIG4e';
    const removedCoverSelector = '.videoImage > .Lg3VSTnf';
    const cards = new Map();
    let openingMenu = false;
    let frame = 0;
    let positionFrame = 0;

    function onJingxuanList() {
        return /^\/jingxuan\/?$/.test(location.pathname) && !new URLSearchParams(location.search).has('modal_id');
    }

    function workId(card) {
        const ids = new Set();
        for (const element of [card, ...card.querySelectorAll(workReferences)]) {
            if (element.closest(cardSelector) !== card) continue;
            const attribute = element.getAttribute('data-aweme-id');
            if (/^\d+$/.test(attribute ?? '')) ids.add(attribute);
            if (!(element instanceof HTMLAnchorElement) || element.origin !== location.origin) continue;

            const id = /^\/(?:video|note)\/(\d+)\/?$/.exec(element.pathname)?.[1]
                ?? (/^\/jingxuan\/?$/.test(element.pathname) ? new URLSearchParams(element.search).get('modal_id') : null);
            if (/^\d+$/.test(id ?? '')) ids.add(id);
        }
        return ids.size === 1 ? ids.values().next().value : null;
    }

    function nativeMenuItem(more) {
        // 菜单渲染在卡片外。只有当前唯一展开的三点属于目标卡片时才取菜单项。
        const opened = document.querySelectorAll(openMoreSelector);
        if (opened.length !== 1 || opened[0] !== more) return null;
        const items = [...document.querySelectorAll('.RJudxp8S > .u4YX0wq2')].filter((item) =>
            item.textContent.trim() === '不感兴趣' && item.getClientRects().length > 0);
        return items.length === 1 ? items[0] : null;
    }

    function waitForMenu(check) {
        const current = check();
        if (current) return current;
        return new Promise((resolve) => {
            const watcher = new MutationObserver(() => {
                const current = check();
                if (current) finish(current);
            });
            const timer = setTimeout(() => finish(null), 1500);
            function finish(result) {
                clearTimeout(timer);
                watcher.disconnect();
                resolve(result);
            }
            watcher.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        });
    }

    async function submitFeedback(card, id) {
        const more = card.querySelector(moreSelector);
        if (!more || more.closest(cardSelector) !== card) throw new Error('未找到该卡片的三点菜单');
        const opened = document.querySelector(openMoreSelector);
        if (opened && opened !== more) throw new Error('请先关闭其他卡片的菜单');

        card.classList.add('mdga-feedback-opening');
        try {
            if (!opened) more.click();
            const item = await waitForMenu(() => nativeMenuItem(more));
            if (!item) throw new Error('未找到原生不感兴趣菜单项');
            if (!onJingxuanList() || !card.isConnected || workId(card) !== id || nativeMenuItem(more) !== item) {
                throw new Error('原生菜单已切换到其他卡片');
            }
            item.click();
            await waitForMenu(() => !more.isConnected || !more.matches(openMoreSelector));
        } finally {
            card.classList.remove('mdga-feedback-opening');
        }
    }

    async function markNotInterested(card, entry, event) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.isTrusted || !onJingxuanList() || openingMenu || cards.get(card) !== entry
            || workId(card) !== entry.id || card.querySelector(removedCoverSelector)) return;

        openingMenu = true;
        setButtonStatus(entry.button, 'pending');
        let status = 'idle';
        try {
            await submitFeedback(card, entry.id);
        } catch {
            status = 'failed';
        } finally {
            openingMenu = false;
            setButtonStatus(entry.button, status);
            scheduleRefresh();
        }
    }

    function findCover(card) {
        const fits = (media) => media.closest(cardSelector) === card && media.clientWidth >= 96 && media.clientHeight >= 60;
        const video = [...card.querySelectorAll('video')].find(fits);
        if (video) return video.closest('.xgplayer') ?? video.parentElement;

        const image = [...card.querySelectorAll('img')].find(fits);
        if (!image) return null;
        const media = image.closest('picture') ?? image;
        const container = media.parentElement;
        return container !== card && container.clientHeight <= image.clientHeight + 4 ? container : media;
    }

    function addControls(card, id, cover) {
        cover.classList.add(coverClass);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mdga-feedback-button';
        button.innerHTML = '<svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4H3v11h4m0-11h11a2 2 0 0 1 2 1.7l1 8A2 2 0 0 1 19 16h-5v3a2 2 0 0 1-2 2l-5-6V4Z"/></svg>';
        setButtonStatus(button, 'idle');

        const entry = { id, cover, button };
        button.addEventListener('click', (event) => void markNotInterested(card, entry, event));
        card.append(button);
        cards.set(card, entry);
        return entry;
    }

    function removeControls(card, entry) {
        entry.cover.classList.remove(coverClass);
        entry.button.remove();
        cards.delete(card);
    }

    function positionButton(entry) {
        const parent = entry.button.offsetParent;
        if (!parent) return;
        const cover = entry.cover.getBoundingClientRect();
        const origin = parent.getBoundingClientRect();
        entry.button.style.left = `${cover.left - origin.left - parent.clientLeft + parent.scrollLeft + 8}px`;
        entry.button.style.top = `${cover.top - origin.top - parent.clientTop + parent.scrollTop + 8}px`;
    }

    function setButtonStatus(button, status) {
        const failed = status === 'failed';
        button.setAttribute('aria-disabled', String(status === 'pending'));
        button.classList.toggle('mdga-feedback-failed', failed);
        button.setAttribute('aria-label', failed ? '提交失败，点击重试' : '不感兴趣');
    }

    function refreshCards() {
        const staleCards = new Set(cards.keys());
        const listCards = onJingxuanList() ? document.querySelectorAll(cardSelector) : [];
        for (const card of listCards) {
            staleCards.delete(card);
            const id = card.querySelector(removedCoverSelector) ? null : workId(card);
            let entry = cards.get(card);
            if (entry && (entry.id !== id || entry.button.parentElement !== card)) {
                removeControls(card, entry);
                entry = undefined;
            }
            if (!id) continue;

            const cover = findCover(card);
            if (!entry && cover) entry = addControls(card, id, cover);
            if (!entry) continue;
            if (cover && entry.cover !== cover) {
                entry.cover.classList.remove(coverClass);
                cover.classList.add(coverClass);
                entry.cover = cover;
            }
            entry.button.hidden = !cover;
            if (cover) positionButton(entry);
        }
        for (const card of staleCards) removeControls(card, cards.get(card));
    }

    function scheduleRefresh() {
        if ((!onJingxuanList() && cards.size === 0) || frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            refreshCards();
        });
    }

    function schedulePositions() {
        if (cards.size === 0 || frame || positionFrame) return;
        positionFrame = requestAnimationFrame(() => {
            positionFrame = 0;
            for (const entry of cards.values()) {
                if (!entry.button.hidden) positionButton(entry);
            }
        });
    }

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'data-aweme-id'] });
    window.addEventListener('resize', scheduleRefresh);
    window.addEventListener('scroll', schedulePositions, { capture: true, passive: true });
    window.addEventListener('load', scheduleRefresh, true);
    document.addEventListener('loadedmetadata', scheduleRefresh, true);
    window.navigation?.addEventListener('navigatesuccess', scheduleRefresh);
    scheduleRefresh();
})();

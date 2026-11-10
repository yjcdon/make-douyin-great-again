(() => {
    'use strict';

    const cardSelector = '.discover-video-card-item';
    const workReferences = 'a[href*="/video/"], a[href*="/note/"], a[href*="modal_id="], [data-aweme-id]';
    const coverClass = 'mdga-feedback-cover';
    const feedbackByWork = new Map();
    const cards = new Map();
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

    function submitFeedback(id) {
        const url = new URL('https://www-hj.douyin.com/aweme/v1/web/commit/dislike/item/');
        url.search = new URLSearchParams({
            aweme_id: id,
            device_platform: 'webapp',
            aid: '6383',
            channel: 'channel_pc_web',
            pc_client_type: '1'
        });

        // 使用抖音页面当前的 XHR，让站点处理会话和请求参数。
        return new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open('POST', url.href);
            request.withCredentials = true;
            request.responseType = 'json';
            request.timeout = 10000;
            request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            request.addEventListener('load', () => {
                if (request.status >= 200 && request.status < 300 && request.response?.status_code === 0) {
                    resolve();
                } else {
                    reject(new Error('抖音未确认反馈成功'));
                }
            });
            request.addEventListener('error', () => reject(new Error('反馈请求失败')));
            request.addEventListener('timeout', () => reject(new Error('反馈请求超时')));
            request.addEventListener('abort', () => reject(new Error('反馈请求中断')));
            request.send(new URLSearchParams({ aweme_id: id }).toString());
        });
    }

    async function markNotInterested(card, entry, event) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.isTrusted || !onJingxuanList() || cards.get(card) !== entry || workId(card) !== entry.id) return;

        const status = feedbackByWork.get(entry.id);
        if (status === 'pending' || status === 'submitted') return;

        feedbackByWork.set(entry.id, 'pending');
        updateControls(entry, entry.cover.isConnected);
        scheduleRefresh();
        try {
            await submitFeedback(entry.id);
            feedbackByWork.set(entry.id, 'submitted');
        } catch {
            feedbackByWork.set(entry.id, 'failed');
        } finally {
            if (onJingxuanList() && cards.get(card) === entry && workId(card) === entry.id) {
                updateControls(entry, entry.cover.isConnected);
            }
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

        const mask = document.createElement('div');
        mask.className = 'mdga-feedback-mask';
        mask.hidden = true;
        mask.innerHTML = `
            <div class="mdga-feedback-message">
                <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="m8 9 1.5 1.5L8 12m8-3-1.5 1.5L16 12m-7 4a4 4 0 0 1 6 0"></path>
                </svg>
                <span>内容不感兴趣</span>
            </div>
        `;
        const entry = { id, cover, button, mask };
        button.addEventListener('click', (event) => void markNotInterested(card, entry, event));
        mask.addEventListener('click', (event) => event.stopPropagation());
        card.append(button, mask);
        cards.set(card, entry);
        return entry;
    }

    function removeControls(card, entry) {
        entry.cover.classList.remove(coverClass);
        entry.button.remove();
        entry.mask.remove();
        cards.delete(card);
    }

    function positionControls(entry) {
        const masked = !entry.mask.hidden;
        const control = masked ? entry.mask : entry.button;
        const parent = control.offsetParent;
        if (!parent) return;
        const cover = entry.cover.getBoundingClientRect();
        const origin = parent.getBoundingClientRect();
        const inset = masked ? 0 : 8;
        control.style.left = `${cover.left - origin.left - parent.clientLeft + parent.scrollLeft + inset}px`;
        control.style.top = `${cover.top - origin.top - parent.clientTop + parent.scrollTop + inset}px`;
        if (masked) {
            control.style.width = `${cover.width}px`;
            control.style.height = `${cover.height}px`;
        }
    }

    function updateControls(entry, hasCover) {
        const status = feedbackByWork.get(entry.id);
        const hidden = status === 'submitted';
        entry.button.hidden = !hasCover || hidden;
        entry.button.setAttribute('aria-disabled', String(status === 'pending'));
        entry.button.classList.toggle('mdga-feedback-failed', status === 'failed');
        const label = status === 'failed' ? '提交失败，点击重试' : '不感兴趣';
        entry.button.title = label;
        entry.button.setAttribute('aria-label', label);
        entry.mask.hidden = !hasCover || !hidden;
        if (hasCover) positionControls(entry);
    }

    function refreshCards() {
        const isList = onJingxuanList();
        for (const [card, entry] of cards) {
            if (!isList || !card.isConnected || entry.button.parentElement !== card
                || entry.mask.parentElement !== card || workId(card) !== entry.id) {
                removeControls(card, entry);
            }
        }
        if (!isList) return;

        for (const card of document.querySelectorAll(cardSelector)) {
            const id = workId(card);
            if (!id) continue;
            const cover = findCover(card);
            let entry = cards.get(card);
            if (!entry && cover) entry = addControls(card, id, cover);
            if (!entry) continue;
            if (cover && entry.cover !== cover) {
                entry.cover.classList.remove(coverClass);
                cover.classList.add(coverClass);
                entry.cover = cover;
            }
            updateControls(entry, Boolean(cover));
        }
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
                if (!entry.button.hidden || !entry.mask.hidden) positionControls(entry);
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

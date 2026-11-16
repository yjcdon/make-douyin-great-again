(() => {
    'use strict';

    const preference = 'showDoubao';
    const infoSelector = '[data-e2e="video-info"]';
    const iconUrl = chrome.runtime.getURL('icons/doubao-64.png');
    const toolbars = new Map();
    let enabled = false;
    let prompt = defaultDoubaoPrompt;
    let frame;

    function videoIdFromPage(params) {
        return /^\/video\/(\d+)\/?$/.exec(location.pathname)?.[1] ?? params.get('modal_id');
    }

    function isRecommendation(params) {
        return location.pathname === '/' && params.get('recommend') === '1';
    }

    function videoId(info) {
        const params = new URLSearchParams(location.search);
        let id = videoIdFromPage(params);
        if (!id && isRecommendation(params)) {
            // 切换标签页时播放器的活动标记可能变化，作品 ID 仍属于这个播放器。
            id = info.closest('[data-e2e-vid]')?.dataset.e2eVid;
        }
        return /^\d+$/.test(id ?? '') && (!info.dataset.e2eAwemeId || info.dataset.e2eAwemeId === id)
            ? id : null;
    }

    async function requestBackground(message) {
        const response = await chrome.runtime.sendMessage(message);
        if (!response || response.error) throw new Error(response?.error ?? '扩展后台未响应');
    }

    async function openDoubao(event, info) {
        if (!event.isTrusted) return;
        event.stopPropagation();
        const button = event.currentTarget;
        if (!enabled || !hasExtensionContext()) return;
        const id = videoId(info);
        if (!id) return;

        const video = button.closest('.basePlayerContainer, .xgplayer')?.querySelector('video');
        if (video && !video.paused) video.pause();

        const text = `https://www.douyin.com/video/${id}\n${prompt}`;
        try {
            await requestBackground({ type: 'openDoubao', text });
        } catch (error) {
            if (hasExtensionContext()) console.warn('打开豆包失败', error);
        }
    }

    /** 把完整播放地址交给 Chrome，保持当前视频的播放状态。 */
    async function downloadVideo(event, info, status) {
        if (!event.isTrusted || !hasExtensionContext()) return;
        event.stopPropagation();
        const id = videoId(info);
        if (!id) return;
        const button = event.currentTarget;
        status.textContent = '';
        let source;
        function receive(event) { source = event.detail; }
        info.addEventListener('mdga-video-source', receive);
        info.dispatchEvent(new CustomEvent('mdga-request-video-source', { detail: id, bubbles: true }));
        info.removeEventListener('mdga-video-source', receive);
        if (!source) {
            status.textContent = '当前视频暂无可用下载地址';
            return;
        }

        const description = info.querySelector('[data-e2e="video-desc"]')?.innerText ?? '';
        const title = description.trim().split(/\n|#(?=\s*\S)/u, 1)[0].trim();
        button.disabled = true;
        try {
            await requestBackground({ type: 'downloadVideo', id, source, title });
        } catch (error) {
            status.textContent = '无法启动下载，请重试';
            if (hasExtensionContext()) console.warn('启动视频下载失败', error);
        } finally {
            button.disabled = false;
        }
    }

    function actionButton(label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mdga-video-action';
        button.setAttribute('aria-label', label);
        return button;
    }

    function refresh() {
        frame = undefined;
        if (!hasExtensionContext()) return;
        const infos = shouldWatchPage() ? [...document.querySelectorAll(infoSelector)].filter(videoId) : [];
        for (const [info, toolbar] of toolbars) {
            if (infos.includes(info) && toolbar.isConnected) continue;
            toolbar.remove();
            toolbars.delete(info);
        }
        for (const info of infos) {
            const existing = toolbars.get(info);
            if (existing) {
                existing.firstElementChild.hidden = !enabled;
                continue;
            }
            const box = info.closest('.player-position-box-bottom') ?? info.parentElement;
            const toolbar = document.createElement('div');
            toolbar.className = 'mdga-video-actions';
            const button = actionButton('提取文案');
            button.hidden = !enabled;
            const icon = document.createElement('img');
            icon.alt = '';
            icon.src = iconUrl;
            button.append(icon);
            button.addEventListener('click', (event) => openDoubao(event, info));
            const download = actionButton('下载视频');
            download.innerHTML = '<svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></svg>';
            const status = document.createElement('span');
            status.className = 'mdga-video-action-status';
            status.setAttribute('role', 'status');
            download.addEventListener('click', (event) => downloadVideo(event, info, status));
            toolbar.append(button, download, status);
            box.prepend(toolbar);
            toolbars.set(info, toolbar);
        }
    }

    function scheduleRefresh() {
        if (frame === undefined) frame = requestAnimationFrame(refresh);
    }

    const observer = new MutationObserver(scheduleRefresh);

    function hasExtensionContext() {
        if (chrome.runtime?.id) return true;
        observer.disconnect();
        window.navigation?.removeEventListener('navigatesuccess', refreshForPage);
        document.removeEventListener('visibilitychange', refreshWhenVisible);
        for (const toolbar of toolbars.values()) toolbar.remove();
        toolbars.clear();
        return false;
    }

    function refreshWhenVisible() {
        if (!document.hidden) refreshForPage();
    }

    function shouldWatchPage() {
        const params = new URLSearchParams(location.search);
        return /^\d+$/.test(videoIdFromPage(params) ?? '') || isRecommendation(params);
    }

    function refreshForPage() {
        if (!hasExtensionContext()) return;
        if (shouldWatchPage()) observer.observe(document.body, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['data-e2e', 'data-e2e-vid', 'data-e2e-aweme-id'],
        });
        else observer.disconnect();
        scheduleRefresh();
    }

    function applyPreference(value) {
        enabled = value !== false;
        refreshForPage();
    }

    let preferenceChanged = false;
    let promptChanged = false;
    chrome.storage.local.onChanged.addListener((changes) => {
        if (changes.doubaoPrompt) {
            promptChanged = true;
            prompt = changes.doubaoPrompt.newValue ?? defaultDoubaoPrompt;
        }
        if (!changes[preference]) return;
        preferenceChanged = true;
        applyPreference(changes[preference].newValue);
    });
    chrome.storage.local.get({ [preference]: true, doubaoPrompt: defaultDoubaoPrompt }).then((settings) => {
        if (!promptChanged) prompt = settings.doubaoPrompt;
        if (!preferenceChanged) applyPreference(settings[preference]);
    }).catch((error) => console.warn('读取豆包按钮设置失败', error));
    window.navigation?.addEventListener('navigatesuccess', refreshForPage);
    document.addEventListener('visibilitychange', refreshWhenVisible);
})();

(() => {
    'use strict';

    const doubaoPreference = 'showDoubao';
    const downloadPreference = 'showVideoDownload';
    const infoSelector = '[data-e2e="video-info"]';
    const iconUrl = chrome.runtime.getURL('icons/doubao-64.png');
    const toolbars = new Map();
    let doubaoEnabled = false;
    let downloadEnabled = true;
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
        if (response?.ok !== true) throw new Error(response?.error ?? '扩展后台未确认操作');
    }

    async function openDoubao(event, info) {
        if (!event.isTrusted) return;
        event.stopPropagation();
        const button = event.currentTarget;
        if (!doubaoEnabled || !hasExtensionContext()) return;
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
        if (!event.isTrusted || !downloadEnabled || !hasExtensionContext()) return;
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

    function mountToolbar(info) {
        const element = document.createElement('div');
        element.className = 'mdga-video-actions';

        const doubaoButton = actionButton('提取文案');
        const icon = document.createElement('img');
        icon.alt = '';
        icon.src = iconUrl;
        doubaoButton.append(icon);
        doubaoButton.addEventListener('click', (event) => openDoubao(event, info));

        const downloadButton = actionButton('下载视频');
        downloadButton.innerHTML = '<svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></svg>';
        const downloadStatus = document.createElement('span');
        downloadStatus.className = 'mdga-video-action-status';
        downloadStatus.setAttribute('role', 'status');
        downloadButton.addEventListener('click', (event) => downloadVideo(event, info, downloadStatus));

        element.append(doubaoButton, downloadButton, downloadStatus);
        const box = info.closest('.player-position-box-bottom') ?? info.parentElement;
        box.prepend(element);

        const toolbar = { element, doubaoButton, downloadButton, downloadStatus };
        toolbars.set(info, toolbar);
        return toolbar;
    }

    function refresh() {
        frame = undefined;
        if (!hasExtensionContext()) return;
        const infos = (doubaoEnabled || downloadEnabled) && shouldWatchPage()
            ? [...document.querySelectorAll(infoSelector)].filter(videoId) : [];
        for (const [info, toolbar] of toolbars) {
            if (infos.includes(info) && toolbar.element.isConnected) continue;
            toolbar.element.remove();
            toolbars.delete(info);
        }
        for (const info of infos) {
            const { doubaoButton, downloadButton, downloadStatus } = toolbars.get(info) ?? mountToolbar(info);
            doubaoButton.hidden = !doubaoEnabled;
            downloadButton.hidden = !downloadEnabled;
            if (!downloadEnabled) downloadStatus.textContent = '';
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
        for (const { element } of toolbars.values()) element.remove();
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

    const changedPreferences = new Set();
    const defaults = { [doubaoPreference]: true, [downloadPreference]: true, doubaoPrompt: defaultDoubaoPrompt };

    chrome.storage.local.onChanged.addListener((changes) => {
        for (const key of Object.keys(defaults)) {
            if (changes[key]) changedPreferences.add(key);
        }
        if (changes.doubaoPrompt) {
            prompt = changes.doubaoPrompt.newValue ?? defaultDoubaoPrompt;
        }
        if (changes[doubaoPreference]) doubaoEnabled = changes[doubaoPreference].newValue !== false;
        if (changes[downloadPreference]) downloadEnabled = changes[downloadPreference].newValue !== false;
        if (changes[doubaoPreference] || changes[downloadPreference]) refreshForPage();
    });
    chrome.storage.local.get(defaults).then((settings) => {
        if (!changedPreferences.has('doubaoPrompt')) prompt = settings.doubaoPrompt;
        if (!changedPreferences.has(downloadPreference)) downloadEnabled = settings[downloadPreference] !== false;
        if (!changedPreferences.has(doubaoPreference)) doubaoEnabled = settings[doubaoPreference] !== false;
        refreshForPage();
    }).catch((error) => console.warn('读取播放器操作设置失败', error));
    window.navigation?.addEventListener('navigatesuccess', refreshForPage);
    document.addEventListener('visibilitychange', refreshWhenVisible);
})();

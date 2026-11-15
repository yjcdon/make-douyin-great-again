(() => {
    'use strict';

    const preference = 'showDoubao';
    const aiSelector = '.ai-douyin-entry';
    const buttonSelector = '.mdga-doubao-button';
    const iconUrl = chrome.runtime.getURL('icons/doubao-64.png');
    const buttons = new WeakMap();
    let enabled = false;
    let prompt = defaultDoubaoPrompt;
    let frame;

    function videoUrl(control) {
        const params = new URLSearchParams(location.search);
        let id = /^\/video\/(\d+)\/?$/.exec(location.pathname)?.[1] ?? params.get('modal_id');
        if (!id && location.pathname === '/' && params.get('recommend') === '1') {
            id = control.closest('[data-e2e="feed-active-video"]')?.dataset.e2eVid;
        }
        return /^\d+$/.test(id ?? '') ? `https://www.douyin.com/video/${id}` : null;
    }

    async function openDoubao(event) {
        if (!event.isTrusted) return;
        event.stopPropagation();
        const button = event.currentTarget;
        if (!enabled || !hasExtensionContext()) return;
        const link = videoUrl(button);
        if (!link) return;

        const video = button.closest('.xgplayer')?.querySelector('video');
        if (video && !video.paused) video.pause();

        const text = `${link}\n${prompt}`;
        try {
            const response = await chrome.runtime.sendMessage({ type: 'openDoubao', text });
            if (!response || response.error) throw new Error(response?.error ?? '扩展后台未响应');
        } catch (error) {
            if (hasExtensionContext()) console.warn('打开豆包失败', error);
        }
    }

    function refresh() {
        frame = undefined;
        if (!hasExtensionContext()) return;
        const staleButtons = new Set(document.querySelectorAll(buttonSelector));
        const controls = enabled ? document.querySelectorAll(aiSelector) : [];
        for (const ai of controls) {
            if (!videoUrl(ai)) continue;
            const aiControl = ai.parentElement;
            const existing = buttons.get(aiControl);
            if (existing && existing === aiControl.previousElementSibling) {
                staleButtons.delete(existing);
                continue;
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mdga-doubao-button';
            if (aiControl.parentElement.querySelector(':scope > .mdga-doubao-position-rail')
                || getComputedStyle(aiControl.parentElement).position === 'static') {
                button.classList.add('mdga-doubao-position-rail');
            }
            button.setAttribute('aria-label', '提取文案');
            const icon = document.createElement('img');
            icon.alt = '';
            icon.src = iconUrl;
            button.append(icon);
            button.addEventListener('click', openDoubao);
            aiControl.before(button);
            buttons.set(aiControl, button);
        }
        for (const button of staleButtons) button.remove();
    }

    function scheduleRefresh() {
        if (frame === undefined) frame = requestAnimationFrame(refresh);
    }

    const observer = new MutationObserver(scheduleRefresh);

    function hasExtensionContext() {
        if (chrome.runtime?.id) return true;
        observer.disconnect();
        window.navigation?.removeEventListener('navigatesuccess', scheduleRefresh);
        for (const button of document.querySelectorAll(buttonSelector)) {
            if (buttons.get(button.nextElementSibling) === button) button.remove();
        }
        return false;
    }

    function applyPreference(value) {
        enabled = value !== false;
        if (enabled) observer.observe(document.body, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['data-e2e', 'data-e2e-vid'],
        });
        else observer.disconnect();
        scheduleRefresh();
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
    window.navigation?.addEventListener('navigatesuccess', scheduleRefresh);
})();

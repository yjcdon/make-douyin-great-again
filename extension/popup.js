(() => {
    'use strict';

    const toggles = [...document.querySelectorAll('[data-preference]')];
    const status = document.getElementById('status');
    const form = document.getElementById('doubao-prompt-form');
    const prompt = document.getElementById('doubao-prompt');
    const savePrompt = form.querySelector('button');

    chrome.storage.local.get(['doubaoPrompt', ...toggles.map((toggle) => toggle.dataset.preference)]).then((settings) => {
        for (const toggle of toggles) {
            toggle.checked = settings[toggle.dataset.preference] !== false;
            toggle.disabled = false;
        }
        prompt.value = settings.doubaoPrompt ?? defaultDoubaoPrompt;
        prompt.disabled = savePrompt.disabled = false;
    }).catch(() => {
        status.textContent = '读取设置失败，请重新打开菜单';
        status.hidden = false;
    });

    async function savePreference(event) {
        const toggle = event.currentTarget;
        const enabled = toggle.checked;
        toggle.disabled = true;
        status.hidden = true;
        try {
            await chrome.storage.local.set({ [toggle.dataset.preference]: enabled });
        } catch {
            toggle.checked = !enabled;
            status.textContent = '保存失败，请重试';
            status.hidden = false;
        } finally {
            toggle.disabled = false;
        }
    }

    for (const toggle of toggles) toggle.addEventListener('change', savePreference);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        prompt.disabled = savePrompt.disabled = true;
        try {
            const value = prompt.value.trim() || defaultDoubaoPrompt;
            await chrome.storage.local.set({ doubaoPrompt: value });
            prompt.value = value;
            status.textContent = '提示词已保存';
        } catch {
            status.textContent = '保存失败，请重试';
        } finally {
            status.hidden = false;
            prompt.disabled = savePrompt.disabled = false;
        }
    });
})();

(() => {
    'use strict';

    const preference = 'disableHoverPreview';
    const toggle = document.getElementById('disable-hover-preview');
    const status = document.getElementById('status');

    chrome.storage.local.get({ [preference]: true }).then((settings) => {
        toggle.checked = settings[preference] !== false;
        toggle.disabled = false;
    }).catch(() => {
        status.textContent = '读取设置失败，请重新打开菜单';
        status.hidden = false;
    });

    toggle.addEventListener('change', async () => {
        const enabled = toggle.checked;
        toggle.disabled = true;
        status.hidden = true;
        try {
            await chrome.storage.local.set({ [preference]: enabled });
        } catch {
            toggle.checked = !enabled;
            status.textContent = '保存失败，请重试';
            status.hidden = false;
        } finally {
            toggle.disabled = false;
        }
    });
})();

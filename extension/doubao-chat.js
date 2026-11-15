(() => {
    'use strict';

    const editorSelector = '.tiptap.ProseMirror[contenteditable="true"]';
    const sendSelector = '[data-testid="chat_input_send_button"]';

    function waitForElement(find) {
        const element = find();
        if (element) return Promise.resolve(element);
        return new Promise((resolve) => {
            const observer = new MutationObserver(() => {
                const element = find();
                if (element) finish(element);
            });
            const timer = setTimeout(() => finish(null), 15000);
            function finish(element) {
                observer.disconnect();
                clearTimeout(timer);
                resolve(element);
            }
            observer.observe(document.body, { subtree: true, childList: true, attributes: true });
        });
    }

    async function sendMessage() {
        if (!/^\/chat\/?$/.test(location.pathname)) return;
        const { text, error } = await chrome.runtime.sendMessage({ type: 'takeDoubaoMessage' });
        if (error) throw new Error(error);
        if (!text) return;

        const editor = await waitForElement(() => document.querySelector(editorSelector));
        if (!editor || editor.textContent.trim()) return;
        editor.focus();
        document.execCommand('insertText', false, text);
        // 富文本编辑器用段落渲染换行，innerText 会多出段间空行。
        const normalize = (value) => value.replace(/\s+/g, ' ').trim();
        const button = await waitForElement(() => {
            const current = document.querySelector(editorSelector);
            if (!current || normalize(current.innerText) !== normalize(text)) return null;
            return document.querySelector(`${sendSelector}[aria-disabled="false"]:not(:disabled)`);
        });
        if (button) button.click();
    }

    sendMessage().catch((error) => console.warn('发送到豆包失败', error));
})();

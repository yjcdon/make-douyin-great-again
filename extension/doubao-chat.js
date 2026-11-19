(() => {
    'use strict';

    const editorSelector = '.tiptap.ProseMirror[contenteditable="true"]';

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

    async function fillDraft() {
        if (!/^\/chat\/?$/.test(location.pathname)) return;
        const { text, error } = await chrome.runtime.sendMessage({ type: 'takeDoubaoMessage' });
        if (error) throw new Error(error);
        if (!text) return;

        const editor = await waitForElement(() => document.querySelector(editorSelector));
        if (!editor || editor.textContent.trim()) return;
        editor.focus();
        document.execCommand('insertText', false, text);
    }

    fillDraft().catch((error) => console.warn('填写豆包草稿失败', error));
})();

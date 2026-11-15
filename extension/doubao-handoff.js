const doubaoChatUrl = 'https://www.doubao.com/chat';
const pendingKey = (tabId) => `doubaoPending:${tabId}`;

chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.frameId !== 0 || !sender.tab || !sender.url) return;
    const url = new URL(sender.url);

    async function handoff() {
        if (message.type === 'openDoubao' && url.origin === 'https://www.douyin.com'
            && typeof message.text === 'string') {
            // sender.url 可能保留站内跳转前的地址，只用它确认消息来源。
            const link = message.text.split('\n', 1)[0];
            if (!/^https:\/\/www\.douyin\.com\/video\/\d+$/.test(link)) {
                throw new Error('无法确认抖音视频链接');
            }
            const tab = await chrome.tabs.create({ url: 'about:blank' });
            await chrome.storage.session.set({ [pendingKey(tab.id)]: message.text });
            await chrome.tabs.update(tab.id, { url: doubaoChatUrl });
        }
        if (message.type === 'takeDoubaoMessage' && url.origin === 'https://www.doubao.com'
            && /^\/chat\/?$/.test(url.pathname)) {
            const key = pendingKey(sender.tab.id);
            const pending = await chrome.storage.session.get(key);
            if (pending[key]) await chrome.storage.session.remove(key);
            return pending[key];
        }
    }

    handoff().then((text) => respond({ text }), (error) => respond({ error: error.message }));
    return true;
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(pendingKey(tabId)));

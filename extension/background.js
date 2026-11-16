const doubaoChatUrl = 'https://www.doubao.com/chat';
const pendingKey = (tabId) => `doubaoPending:${tabId}`;

async function downloadVideo({ source, id, title }) {
    const url = new URL(source);
    const playApi = url.origin === 'https://www.douyin.com' && url.pathname === '/aweme/v1/play/';
    if (url.protocol !== 'https:' || !(playApi || /(^|\.)douyinvod\.com$/.test(url.hostname))
        || !/^\d+$/.test(id ?? '')) {
        throw new Error('无法确认视频下载地址');
    }
    const safeTitle = typeof title === 'string' ? title.replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ') : '';
    const filename = [...safeTitle].slice(0, 60).join('').replace(/[.\s]+$/g, '').trim() || `douyin-${id}`;
    await chrome.downloads.download({
        url: url.href,
        filename: `${filename}.mp4`,
        conflictAction: 'uniquify',
    });
}

async function openDoubao(text) {
    const link = typeof text === 'string' ? text.split('\n', 1)[0] : '';
    if (!/^https:\/\/www\.douyin\.com\/video\/\d+$/.test(link)) {
        throw new Error('无法确认抖音视频链接');
    }
    // 先按标签页保存内容，再进入豆包，确保聊天脚本加载后可以立即读取。
    const tab = await chrome.tabs.create({ url: 'about:blank' });
    await chrome.storage.session.set({ [pendingKey(tab.id)]: text });
    await chrome.tabs.update(tab.id, { url: doubaoChatUrl });
}

async function takeDoubaoMessage(tabId) {
    const key = pendingKey(tabId);
    const pending = await chrome.storage.session.get(key);
    if (pending[key]) await chrome.storage.session.remove(key);
    return pending[key];
}

async function handleMessage(message, sender) {
    const url = new URL(sender.url);
    // 抖音站内跳转时 sender.url 可能保留旧路径，只用它确认来源。
    switch (message?.type) {
        case 'downloadVideo':
            if (url.origin !== 'https://www.douyin.com') break;
            await downloadVideo(message);
            return { ok: true };
        case 'openDoubao':
            if (url.origin !== 'https://www.douyin.com') break;
            await openDoubao(message.text);
            return { ok: true };
        case 'takeDoubaoMessage':
            if (url.origin !== 'https://www.doubao.com' || !/^\/chat\/?$/.test(url.pathname)) break;
            return { text: await takeDoubaoMessage(sender.tab.id) };
    }
    throw new Error('无法处理此扩展请求');
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.frameId !== 0 || !sender.tab || !sender.url) return;
    handleMessage(message, sender).then(respond, (error) => respond({ error: error.message }));
    return true;
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(pendingKey(tabId)));

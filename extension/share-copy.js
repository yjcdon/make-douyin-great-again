(() => {
    'use strict';

    const shareTimeoutMs = 5000;
    const shareCodeStart = /^\s*\d{1,2}\.\d{1,2}\s+/u;
    const requiredShareFields = [/^\d{1,2}\/\d{1,2}$/u, /^\w+:\/$/u, /^\S+@\S+$/u];
    const shareTime = /^:\d{1,2}(?:am|pm)$/iu;
    const shareSuffix = /\s+(https:\/\/v\.douyin\.com\/[\w-]+\/?)\s+复制此链接[，,]\s*打开(?:Dou\s*音|抖音)搜索[，,]\s*直接观看视频[！!。]?\s*$/iu;
    let shareDeadline = -Infinity;

    // 日期、两段识别码和可选时间的顺序会变化，每类只消耗一次。
    function findCaptionStart(text) {
        const start = shareCodeStart.exec(text);
        if (!start) return -1;

        const remainingFields = new Set([...requiredShareFields, shareTime]);
        const nextToken = /(\S+)\s+/uy;
        let captionStart = start[0].length;
        nextToken.lastIndex = captionStart;
        for (let token = nextToken.exec(text); token; token = nextToken.exec(text)) {
            const field = [...remainingFields].find((pattern) => pattern.test(token[1]));
            if (!field) break;
            remainingFields.delete(field);
            captionStart = nextToken.lastIndex;
        }

        return requiredShareFields.some((field) => remainingFields.has(field)) ? -1 : captionStart;
    }

    function formatShareText(text) {
        if (typeof text !== 'string') return text;
        const suffix = shareSuffix.exec(text);
        if (!suffix) return text;
        const captionStart = findCaptionStart(text);
        if (captionStart < 0 || captionStart >= suffix.index) return text;

        const caption = text.slice(captionStart, suffix.index);
        const title = caption.split(/#(?=\s*\S)/u, 1)[0].replace(/\s*[\r\n]+\s*/gu, ' ').trim();
        return title ? `${title}\n${suffix[1]}` : text;
    }

    window.addEventListener('keydown', (event) => {
        if (!event.isTrusted || event.repeat) return;
        const key = event.key.toLowerCase();
        if ((event.metaKey || event.ctrlKey) && key === 'c') {
            shareDeadline = -Infinity;
        }
        if (key !== 'v' || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

        const target = event.composedPath()[0];
        if (target instanceof Element && (target.isContentEditable || target.matches('input, textarea, select, [role="textbox"]'))) return;

        shareDeadline = performance.now() + shareTimeoutMs;
    }, true);

    const writeText = Clipboard.prototype.writeText;
    Clipboard.prototype.writeText = function (text) {
        if (performance.now() < shareDeadline) {
            const formatted = formatShareText(text);
            if (formatted !== text) return writeText.call(this, formatted);
        }
        return writeText.apply(this, arguments);
    };

    // 部分复制库先选中临时节点，再调用 execCommand('copy')。
    function formatLegacyCopy(event) {
        const active = document.activeElement;
        const text = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement
            ? active.value.slice(active.selectionStart, active.selectionEnd)
            : document.getSelection()?.toString();
        const formatted = formatShareText(text);
        if (formatted === text || !event.clipboardData) return;

        event.clipboardData.setData('text/plain', formatted);
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    const execCommand = Document.prototype.execCommand;
    Document.prototype.execCommand = function (command) {
        if (this !== document || performance.now() >= shareDeadline || typeof command !== 'string' || command.toLowerCase() !== 'copy') {
            return execCommand.apply(this, arguments);
        }

        window.addEventListener('copy', formatLegacyCopy, true);
        try {
            return execCommand.apply(this, arguments);
        } finally {
            window.removeEventListener('copy', formatLegacyCopy, true);
        }
    };
})();

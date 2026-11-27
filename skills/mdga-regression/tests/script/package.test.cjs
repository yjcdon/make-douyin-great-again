const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const extension = path.resolve(__dirname, '../../../../extension');

test('[PKG-01] 扩展清单和弹窗引用的文件存在', function test_PKG_01() {
    const manifest = JSON.parse(readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
    const assets = [
        manifest.background.service_worker,
        manifest.action.default_popup,
        ...Object.values(manifest.icons),
        ...Object.values(manifest.action.default_icon),
        ...manifest.web_accessible_resources.flatMap(entry => entry.resources),
        ...manifest.content_scripts.flatMap(entry => [...(entry.js ?? []), ...(entry.css ?? [])]),
    ];
    for (const asset of new Set(assets)) {
        assert.ok(statSync(path.join(extension, asset), { throwIfNoEntry: false })?.isFile(), asset);
    }

    const popup = path.join(extension, manifest.action.default_popup);
    for (const [, source] of readFileSync(popup, 'utf8').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
        assert.ok(statSync(path.resolve(path.dirname(popup), source), { throwIfNoEntry: false })?.isFile(), source);
    }
});

test('[PKG-02] 扩展脚本通过语法检查', function test_PKG_02() {
    const scripts = readdirSync(extension, { recursive: true }).filter(file => file.endsWith('.js'));
    assert.ok(scripts.length, '扩展应包含 JavaScript 文件');
    for (const script of scripts) {
        execFileSync(process.execPath, ['--check', path.join(extension, script)], { stdio: 'pipe' });
    }
});

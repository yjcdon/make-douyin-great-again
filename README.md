# Make Douyin Great Again

Make Douyin Great Again（MDGA）是一款抖音网页版扩展。按 `V` 分享时只复制作品标题和短链接，在抖音精选页还可以一键标记「不感兴趣」和关闭封面悬浮预览。

[下载最新版扩展](https://github.com/yjcdon/make-douyin-great-again/releases/latest)

## 功能

- **精简分享文案。** 播放作品时按抖音快捷键 `V`，粘贴后第一行是作品标题，第二行是抖音原短链接。扩展会移除分享口令、话题标签和打开提示。
- **一键标记不感兴趣。** 在抖音精选页，把鼠标移到封面，点击左上角的拇指图标。操作后可通过卡片下方的抖音原生「撤销」恢复。
- **关闭封面悬浮预览。** 默认关闭精选页的悬浮预览，点击封面仍可观看。想恢复预览时，点击浏览器工具栏的 MDGA 图标，取消勾选「关闭悬浮浏览」。

## 安装

适用于 Chrome 111 及以上版本，也可在 Microsoft Edge 中按以下步骤加载。扩展作用于 `www.douyin.com`。

1. 在最新版下载页的 **Assets** 中下载 `make-douyin-great-again-v*.zip` 并解压。
2. 在地址栏打开 `chrome://extensions`，Edge 用户打开 `edge://extensions`。
3. 开启「开发者模式」，点击「加载已解压的扩展程序」，选择解压后包含 `manifest.json` 的文件夹。
4. 刷新已打开的抖音页面。

从源码安装时，选择仓库中的 [`extension/`](extension/) 文件夹。

## 使用提示

分享精简适用于扩展能识别的抖音分享文案。标题里有 `#` 时，扩展可能把后面的文字视为话题。

[精选页快捷反馈说明](docs/jingxuan-not-interested.md)

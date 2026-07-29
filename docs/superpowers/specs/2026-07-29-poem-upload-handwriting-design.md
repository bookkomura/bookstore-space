# 拾字成詩手寫字體設計

## 目標

讓「拾字成詩」載入動畫中的主字與等待文案，與「小村碎碎念」使用相同的手寫字體語氣，強化字句從詩頁浮現的感受。

## 範圍

只調整 `PoemUploadOverlay` 載入層的字體設定。

- 「拾、字、成、詩」四個主字使用 `LXGW WenKai TC`。
- 「正在鋪開詩頁⋯⋯」使用 `LXGW WenKai TC`。
- 關閉按鈕、iframe 內容、動畫時序、載入狀態與 iframe 合約均不變。

## 實作方式

專案的 `index.html` 已由 Google Fonts 載入 `LXGW WenKai TC`，而「小村碎碎念」在 `NewsletterArchive` 已以 `"LXGW WenKai TC", "Noto Serif TC", serif` 作為字體堆疊。`PoemUploadOverlay` 應使用相同堆疊，讓字型尚未就緒時仍有可讀的中文襯線替代字。

不新增網路請求、字型檔或依賴；僅在 `.poem-characters` 與 `.loading p` 設定字體。

## 驗證

- 保留既有載入層、iframe、關閉事件與 reduced-motion 測試。
- 元件測試確認兩個文字區塊仍存在並保留既有載入文案。
- 手動預覽確認四字與文案呈現手寫字感，關閉鍵維持清楚的系統字體。

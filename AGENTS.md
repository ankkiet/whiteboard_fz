# Quy tắc quản lý phiên bản và phát hành fzInK

## 1. Quy ước đặt tên phiên bản (bắt buộc)

- **Phiên bản ứng dụng & Git tag**: Luôn dùng định dạng `v_fz.<các-phân-đoạn-số>` (ví dụ: `v_fz.1.1.1.1.13`, `v_fz.1.1.1.2.12`, `v_fz.1.1.1.2.13`).
- **Tuyệt đối không** đổi tên phiên bản trong `version.json`, `app-version.json`, `LATEST_DESKTOP_VERSION_FALLBACK` hoặc Git tag sang dạng semver ngắn (`1.2.12`, `v1.2.12`).
- **`package.json` (`version`)** chỉ giữ vai trò `nativeVersion` (chuỗi semver hợp lệ cho npm / `electron-builder`, khớp với `app.getVersion()` trong Electron, hiện là `1.2.12`). Không bao giờ lấy `package.json` `version` để ghi đè `version` trong `version.json`.
- Khi nâng số phiên bản mới, các đoạn số đọc theo thứ tự từ trái sang phải phải **lớn hơn về mặt số học** so với bản trước (vì `compareVersionStrings` trong `src/engine/versionCheck.ts` và `compareVersions` trong `electron/otaUpdater.cjs` tách mọi nhóm `\d+` để so sánh).

## 2. Quy trình nâng phiên bản 2 tầng

### Tầng 1: Cập nhật nhỏ qua OTA (`web-update.zip`)
Áp dụng khi **chỉ** thay đổi mã nguồn giao diện/web/canvas/toán (`src/`, `public/`, `index.html`) và **không** chỉnh sửa lớp Electron (`electron/*`, `package.json`, `electron/builder.json`).

1. Trong `version.json`:
   - Tăng phân đoạn cuối của `"version"` (ví dụ `v_fz.1.1.1.2.12` → `v_fz.1.1.1.2.13`).
   - Cập nhật `"notes"` mô tả ngắn gọn nội dung bản vá.
   - **Giữ nguyên** `"minNativeVersion"` và `"version"` trong `package.json`.
2. Cập nhật `LATEST_DESKTOP_VERSION_FALLBACK` trong `src/services/appUpdater.ts` (nếu cần đồng bộ hiển thị web).
3. Chạy kiểm tra và build web (`vite build`) để tạo `dist/web-update.zip` + `dist/app-version.json`, sau đó deploy `dist/` lên Cloudflare Pages (`https://whiteboardfz.pages.dev`).
4. Không cần tạo Git tag mới hay build lại `.exe` / `.dmg`.

### Tầng 2: Cập nhật lớn qua bộ cài đặt (`.exe` / `.dmg`)
Áp dụng khi chỉnh sửa `electron/main.cjs`, `electron/preload.cjs`, `electron/otaUpdater.cjs`, `electron/builder.json`, thay đổi dependency/phiên bản `electron` trong `package.json`, hoặc thay đổi cơ chế IPC/protocol.

1. Trong `package.json`: tăng `"version"` theo semver (ví dụ `1.2.12` → `1.2.13` hoặc `1.3.0`).
2. Trong `version.json`:
   - Đặt `"minNativeVersion"` bằng đúng `"version"` mới của `package.json`.
   - Tăng `"version"` theo chuẩn `v_fz.*` (ví dụ `v_fz.1.1.1.2.12` → `v_fz.1.1.1.3.0`).
   - Cập nhật `"notes"`.
3. Cập nhật `LATEST_DESKTOP_VERSION_FALLBACK` trong `src/services/appUpdater.ts` trùng với `version.json`.
4. Chạy kiểm tra (`npx tsc --noEmit`, test suite) và đóng gói thử (`npm run desktop:win` trên Windows nếu cần).
5. Commit thay đổi, gắn **Git tag trùng khớp chính xác** với `"version"` trong `version.json` (ví dụ `git tag v_fz.1.1.1.3.0`) và push cả nhánh `main` lẫn tag lên `origin` để `.github/workflows/build-desktop.yml` build và phát hành GitHub Release.

## 3. Checklist xác minh trước khi phát hành

- Đọc `dist/app-version.json` sau `vite build`, kiểm tra đủ và đúng:
  - `"version"` bắt đầu bằng `v_fz.` và lớn hơn phiên bản đang phát hành.
  - `"nativeVersion"` khớp `package.json`.
  - `"minNativeVersion"` đúng với tầng cập nhật dự kiến (bằng bản native cũ nếu là OTA, bằng bản native mới nếu bắt buộc cài lại).
  - Có đủ `"otaBundleUrl"`, `"otaBundleSha256"`, `"otaBundleSize"`.
- Chạy thành công:
  - `npx tsc --noEmit`
  - `npx tsx --test src/engine/versionCheck.test.ts src/services/appUpdater.test.ts electron/otaUpdater.test.cjs`

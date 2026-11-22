# BẢN THIẾT KẾ & LỘ TRÌNH PHÁT TRIỂN: WEB BẢNG TRẮNG THÔNG MINH (SMART WHITEBOARD)

## 1. Tổng quan Dự án (Project Overview)
* **Mục tiêu:** Xây dựng ứng dụng bảng trắng chạy trên nền web (Web Whiteboard) có tốc độ phản hồi 60fps, mang lại cảm giác viết vẽ mượt mà như trên giấy/iPad, kết hợp khả năng chèn ảnh, đọc & ghi chú trực tiếp lên tài liệu (PDF/File) và trình bày chuyên nghiệp.
* **Đối tượng sử dụng:** Giảng viên, người thuyết trình, học sinh/sinh viên, đội nhóm cần bảng nháp ý tưởng và trình bày tài liệu trực quan.
* **Triết lý thiết kế:** Tối giản (Minimalist), không gian vẽ chiếm trên 95% màn hình, thanh công cụ nổi gọn gàng, hỗ trợ đầy đủ thao tác chuột, cảm ứng và bút vẽ (Stylus/Apple Pencil/Wacom).

---

## 2. Thiết kế Giao diện & Trải nghiệm (UI/UX Architecture)

### 2.1. Bố cục màn hình (Workspace Layout)
* **Vùng trung tâm (Infinite Canvas):** Không gian vô tận hỗ trợ kéo trượt (Pan) và phóng to/thu nhỏ (Zoom mượt vào đúng vị trí con trỏ chuột).
* **Thanh công cụ chính (Bottom Floating Dock):** Nằm nổi ở giữa phía dưới màn hình, chứa các công cụ cốt lõi:
  1. Con trỏ chọn & di chuyển (`Select - V`)
  2. Bàn tay kéo bảng (`Hand/Pan - H`)
  3. Bút vẽ mượt (`Pen - P`)
  4. Bút dạ quang (`Highlighter - M`)
  5. Tẩy theo nét (`Eraser - E`)
  6. Hình khối & Mũi tên (`Shapes: Rect, Ellipse, Line, Arrow - R/O/A`)
  7. Văn bản & Ghi chú dán (`Text - T`, `Sticky Note - S`)
  8. Chèn Ảnh / Tài liệu PDF / File (`Insert Media & Docs - I`)
  9. Khung trang trình bày (`Frame - F`)
  10. Bút tia Laser (`Laser Pointer - L`)
* **Thanh thuộc tính ngữ cảnh (Contextual Toolbar):** Chỉ hiển thị khi người dùng chọn một công cụ vẽ (chọn màu, độ dày nét, độ trong suốt) hoặc khi chọn một đối tượng trên bảng (xoay, đổi màu, đưa lên trước/ra sau, khóa vị trí, nhân bản, xóa).
* **Góc trên bên trái (File & Page Menu):** Tên bảng trắng, nút Hoàn tác/Làm lại (`Undo/Redo`), danh sách các Frame (slide), menu Lưu / Nhập file JSON / Xuất ảnh PNG & PDF.
* **Góc trên bên phải (View & Present Controls):** Tỷ lệ Zoom (có nút Reset về 100% và Fit to Screen), chuyển đổi chế độ Sáng/Tối (Light/Dark Mode), chọn nền bảng (Trắng trơn, Lưới ô ly, Chấm bi, Dòng kẻ), và nút **Trình bày (Present Mode)**.

### 2.2. Phím tắt tiêu chuẩn (Keyboard Shortcuts)
* `Space + Kéo chuột` hoặc `Chuột giữa`: Kéo trượt bảng tạm thời (Pan).
* `Ctrl + Cuộn chuột` (hoặc chụm 2 ngón trên trackpad): Phóng to / Thu nhỏ (Zoom).
* `Ctrl + V`: Dán trực tiếp hình ảnh từ Clipboard vào đúng trung tâm màn hình đang xem.
* `Ctrl + Z` / `Ctrl + Shift + Z` (hoặc `Ctrl + Y`): Hoàn tác / Làm lại.
* `Delete` / `Backspace`: Xóa đối tượng đang chọn.

---

## 3. Hệ thống Tính năng Chi tiết (Feature Specifications)

### Nhóm 1: Lõi đồ họa & Viết vẽ thông minh
* **Hệ tọa độ chuẩn (World vs. Screen Coordinates):** Chuyển đổi chính xác giữa tọa độ màn hình và tọa độ không gian vô tận với tỷ lệ thu phóng $z$ và độ lệch $(o_x, o_y)$:
  $$x_{\text{screen}} = x_{\text{world}} \cdot z + o_x, \quad y_{\text{screen}} = y_{\text{world}} \cdot z + o_y$$
  $$x_{\text{world}} = \frac{x_{\text{screen}} - o_x}{z}, \quad y_{\text{world}} = \frac{y_{\text{screen}} - o_y}{z}$$
* **Nét bút tự nhiên:** Sử dụng `PointerEvent` (hỗ trợ độ nhấn `e.pressure`) kết hợp thuật toán `perfect-freehand` để tạo nét thanh đậm mượt mà, không bị răng cưa khi vẽ nhanh bằng chuột hay bút cảm ứng.
* **Bút dạ quang (Highlighter):** Nét vẽ bán trong suốt (opacity ~0.35), chế độ hòa trộn để không che mất chữ bên dưới.
* **Tẩy thông minh:** Quẹt qua nét vẽ nào sẽ làm mờ nhẹ báo hiệu và xóa trọn vẹn nét đó khi nhả chuột (Stroke Eraser).

### Nhóm 2: Hình khối, Văn bản & Ghi chú
* **Hình khối cơ bản:** Hình chữ nhật (bo góc), hình tròn/elip, đường thẳng, mũi tên. Hỗ trợ giữ phím `Shift` để vẽ hình vuông, hình tròn đều hoặc đường thẳng góc $45^\circ$.
* **Hộp văn bản & Sticky Notes:** Cho phép nhấp đúp để gõ chữ trực tiếp trên bảng (inline editing), chỉnh cỡ chữ, màu chữ và màu nền ghi chú.

### Nhóm 3: Chèn Hình ảnh, File & Tài liệu
* **Hình ảnh (Images):** Hỗ trợ tải lên từ máy, kéo-thả trực tiếp từ màn hình desktop vào bảng, hoặc dán bằng `Ctrl + V`. Cho phép kéo 4 góc để thay đổi kích thước (giữ đúng tỷ lệ khung hình), xoay và khóa ảnh làm nền để vẽ đè lên.
* **Tài liệu PDF (`pdfjs-dist`):** Khi người dùng tải lên file `.pdf`, hệ thống cho phép chọn 1 trong 2 chế độ:
  1. *Trải trang lên bảng:* Tự động tách các trang PDF thành hình ảnh độ nét cao xếp thành hàng/cột ngay trên bảng để người dùng viết, khoanh tròn, gạch chân trực tiếp lên tài liệu.
  2. *Thẻ xem trước:* Hiển thị dưới dạng thẻ tài liệu gọn gàng có tên file, dung lượng và nút mở xem nhanh.
* **Tệp đính kèm khác (Word, Excel, Zip, Link...):** Tạo thành **File Card** trực quan trên bảng (hiển thị icon định dạng, tên file, dung lượng, nút tải xuống/xem nhanh).

### Nhóm 4: Khung trang & Chế độ Trình bày (Frames & Present)
* **Frame (Khung slide):** Tạo các vùng chữ nhật tỷ lệ chuẩn `16:9` hoặc `A4` có tiêu đề. Khi di chuyển Frame, các đối tượng nằm gọn bên trong có thể di chuyển theo.
* **Chế độ Trình bày (Present Mode):** Ẩn toàn bộ thanh công cụ thiết kế, chỉ giữ lại thanh điều hướng slide nhỏ gọn và nút bật **Bút tia Laser** (nét sáng đỏ rực có đuôi tự động tan biến sau 1.5–2 giây). Hỗ trợ phím mũi tên Trái/Phải để chuyển mượt mà (smooth camera pan/zoom) giữa các Frame.

### Nhóm 5: Lưu trữ & Xuất bản (Persistence & Export)
* **Lưu tự động (Offline-first):** Lưu toàn bộ trạng thái bảng (bao gồm cả ảnh/trang PDF dưới dạng Blob/DataURL) vào **IndexedDB** để tránh giới hạn 5MB của `localStorage`.
* **Sao lưu & Chia sẻ:** Xuất/Nhập toàn bộ bảng dưới dạng tệp `.whiteboard.json`.
* **Xuất tài liệu:** Xuất toàn bộ bảng hoặc từng Frame thành hình ảnh **PNG** (nền trong suốt hoặc có nền) và xuất chuỗi các Frame thành tệp **PDF**.

---

## 4. Kiến trúc Kỹ thuật Đề xuất (Tech Stack & Structure)

### 4.1. Công nghệ sử dụng (Tech Stack)
* **Core Framework:** React 18+ với TypeScript và Vite.
* **Styling & Icons:** Tailwind CSS + `lucide-react`.
* **State Management:** `zustand` (quản lý state gọn nhẹ, tách biệt rõ dữ liệu Canvas, Camera và Lịch sử Undo/Redo).
* **Rendering Engine:** HTML5 `<canvas>` 2D API (tối ưu bằng `devicePixelRatio` cho màn hình sắc nét và `Viewport Culling` chỉ vẽ những phần tử nằm trong khung nhìn) kết hợp **HTML Overlay Layer** cho các thành phần tương tác như khung gõ Text, Sticky Note và File Card.
* **Thư viện chuyên dụng:**
  * `perfect-freehand`: Làm mượt và tạo nét bút thanh đậm.
  * `pdfjs-dist`: Đọc và render trang PDF trực tiếp trên trình duyệt (client-side).
  * `idb-keyval`: Lưu trữ dữ liệu bảng trắng & tài liệu vào IndexedDB.
  * `jspdf` (tùy chọn ở Phase 4): Xuất các Frame thành tệp PDF.

### 4.2. Cấu trúc Dữ liệu Cốt lõi (Data Schema)
~~~typescript
export type ElementType =
  | 'stroke'
  | 'highlighter'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'text'
  | 'sticky'
  | 'image'
  | 'file-card'
  | 'frame';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  isLocked?: boolean;
  zIndex: number;
}

export interface StrokeElement extends BaseElement {
  type: 'stroke' | 'highlighter';
  points: [number, number, number][]; // [x, y, pressure]
  color: string;
  strokeWidth: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  assetId: string; // Tham chiếu đến Blob/DataURL lưu trong Asset Store (IndexedDB)
  fileName?: string;
}

export interface FileCardElement extends BaseElement {
  type: 'file-card';
  fileName: string;
  fileSize: number;
  mimeType: string;
  assetId: string;
}

export interface FrameElement extends BaseElement {
  type: 'frame';
  title: string;
  aspectRatio?: '16:9' | 'A4' | 'free';
}
~~~

### 4.3. Cấu trúc Thư mục Chuẩn (Dành cho Antigravity)
~~~text
src/
├── components/
│   ├── canvas/
│   │   ├── WhiteboardCanvas.tsx    # Lõi HTML5 Canvas + xử lý PointerEvent
│   │   ├── SelectionOverlay.tsx    # Khung chọn, kéo giãn (resize handles), xoay
│   │   ├── HtmlOverlayLayer.tsx    # Layer hiển thị Text Editor & File Cards
│   │   └── LaserLayer.tsx          # Hiệu ứng bút tia laser tự biến mất
│   ├── toolbar/
│   │   ├── BottomDock.tsx          # Thanh công cụ chính phía dưới
│   │   ├── ContextualToolbar.tsx   # Thanh chỉnh màu, độ dày, thuộc tính
│   │   ├── TopLeftBar.tsx          # Menu file, Undo/Redo, Danh sách Frame
│   │   └── TopRightBar.tsx         # Zoom, Theme, Nền bảng, Nút Present
│   └── modals/
│       ├── PdfImportModal.tsx      # Hộp thoại chọn trang khi chèn PDF
│       └── ExportModal.tsx         # Tùy chọn xuất PNG / PDF / JSON
├── store/
│   ├── useBoardStore.ts            # Zustand store: elements, camera, tool, history
│   └── assetStorage.ts             # Wrapper IndexedDB lưu ảnh và file nặng
├── engine/
│   ├── coordinates.ts              # Toán học chuyển đổi World <-> Screen
│   ├── renderElements.ts           # Hàm vẽ từng loại element lên Canvas 2D
│   ├── hitTest.ts                  # Thuật toán kiểm tra va chạm (chọn & tẩy)
│   └── pdfProcessor.ts             # Xử lý tách trang PDF bằng pdfjs-dist
├── types/
│   └── board.ts                    # Toàn bộ TypeScript Interfaces
└── App.tsx
~~~

---

## 5. Lộ trình Thực hiện Từng Bước (Step-by-Step Execution Plan)

### Bước 0: Quy trình kết hợp Google AI Studio & Antigravity
1. **Giai đoạn Prototype trên Google AI Studio:** Sử dụng AI Studio (chế độ *Build* hoặc chat tạo ứng dụng React) để sinh nhanh bản mẫu chạy thử ngay trên trình duyệt. Mục tiêu của bước này là **kiểm tra cảm giác viết vẽ, màu sắc giao diện và thao tác Pan/Zoom** trước khi đi sâu vào kỹ thuật.
2. **Giai đoạn Phát triển sản phẩm trên Antigravity:** Mở thư mục dự án (hoặc tải mã nguồn từ AI Studio về máy), đặt tệp `whiteboard_blueprint.md` vào thư mục gốc dự án để làm "kim chỉ nam" cho AI Agent của Antigravity. Sau đó yêu cầu Agent tách cấu trúc thư mục sạch sẽ và hoàn thiện từng Phase bên dưới.

### Phase 1: Nền tảng & Cảm giác Viết Vẽ (Core Engine MVP)
* Khởi tạo dự án React + TypeScript + Tailwind + Zustand + `perfect-freehand`.
* Xây dựng hệ tọa độ Infinite Canvas hỗ trợ Pan (`Space + kéo`, công cụ Hand) và Zoom mượt tại vị trí con trỏ chuột.
* Thiết kế 4 loại nền bảng (Trơn, Ô ly, Chấm bi, Dòng kẻ) tự động co giãn theo tỷ lệ Zoom và hỗ trợ Dark/Light mode.
* Hoàn thiện công cụ: **Bút vẽ (`perfect-freehand`)**, **Bút dạ quang**, **Tẩy theo nét** và cơ chế **Undo/Redo** ổn định.
* *Tiêu chí hoàn thành:* Vẽ mượt 60fps trên cả chuột và cảm ứng, kéo/zoom không bị lệch nét.

### Phase 2: Đối tượng, Hình khối & Hình ảnh (Objects & Media)
* Xây dựng công cụ **Select**: click chọn, kéo vùng chọn nhiều đối tượng (marquee selection), di chuyển, thay đổi kích thước (8 điểm neo resize) và khóa đối tượng.
* Thêm công cụ: **Hình chữ nhật, Hình tròn, Đường thẳng, Mũi tên**, **Hộp Văn bản (Text)** và **Ghi chú dán (Sticky Notes)**.
* Tích hợp chèn **Hình ảnh**: hỗ trợ nút tải file, kéo thả trực tiếp từ máy tính và dán nhanh từ clipboard (`Ctrl + V`).
* Hoàn thiện **Contextual Toolbar** (đổi màu, nét vẽ, xóa, nhân bản, thứ tự lớp).

### Phase 3: Xử lý Tài liệu & Trình bày (Documents & Present Mode)
* Tích hợp **`pdfjs-dist`**: Khi người dùng chèn file PDF, cho phép chọn trải toàn bộ (hoặc chọn trang) thành các khung ảnh sắc nét trên bảng để ghi chú đè lên trên.
* Xây dựng **File Card**: Kéo thả bất kỳ file tài liệu nào (`.docx`, `.xlsx`, `.txt`...) lên bảng sẽ tạo thẻ đính kèm có nút tải về/xem thông tin.
* Xây dựng **Hệ thống Frame (Slide 16:9 / A4)** và bảng danh sách Frame ở góc trái.
* Xây dựng **Chế độ Trình bày (Present Mode)**: ẩn thanh công cụ vẽ, điều hướng mượt giữa các Frame bằng phím mũi tên, tích hợp **Bút tia Laser**.

### Phase 4: Lưu trữ Bền vững, Xuất file & Tối ưu (Persistence & Polish)
* Lưu tự động toàn bộ bản vẽ và tệp nhị phân (ảnh/PDF/file) xuống **IndexedDB** (`idb-keyval`) — tải lại trang không mất dữ liệu.
* Tính năng **Xuất/Nhập file dự án (`.json`)**, **Xuất ảnh PNG độ phân giải cao** và **Xuất các Frame thành tệp PDF**.
* Tối ưu hiệu năng (Viewport Culling: bỏ qua không render các đối tượng ngoài khung nhìn; debounce thao tác auto-save).
* Rà soát toàn bộ phím tắt và kiểm thử trên nhiều kích thước màn hình.
# ĐẶC TẢ CHỨC NĂNG TOÀN DIỆN: BẢNG TRẮNG TOÁN HỌC (LỚP 1–12)

> **Mục tiêu:** Mở rộng ứng dụng Web Bảng trắng (Smart Whiteboard) thành một nền tảng giảng dạy và học tập Toán học toàn diện từ Lớp 1 đến Lớp 12 (bám sát Chương trình GDPT 2018), kết hợp giữa **cảm giác viết vẽ tự nhiên** và **hệ thống học cụ toán học tương tác động**.

---

## 1. Triết lý Tổ chức Giao diện: Chế độ Cấp học (Grade Mode)

Để đảm bảo đầy đủ công cụ chuyên sâu cho bậc THPT nhưng vẫn trực quan, tối giản cho học sinh Tiểu học, bảng trắng sử dụng cơ chế **Bộ lọc Cấp học (Grade Mode Switcher)** ngay trên thanh công cụ chính:

* **Chế độ Tiểu học (Lớp 1–5):** Ưu tiên học cụ trực quan kéo-thả (Manipulatives), khung đặt tính, sơ đồ đoạn thẳng, đồng hồ, mô hình phân số và ký hiệu số học cơ bản. Ẩn các công cụ giải tích/3D phức tạp.
* **Chế độ THCS (Lớp 6–9):** Mở khóa công cụ hình học phẳng động, thước/ê-ke/compa ảo, trục số, đồ thị hàm bậc nhất/bậc hai, thống kê cơ bản và mô hình trải hình khối 3D.
* **Chế độ THPT (Lớp 10–12):** Mở đầy đủ trình soạn thảo LaTeX nâng cao, đồ thị hàm số có tham số, trình tạo bảng biến thiên, vòng tròn lượng giác, không gian 3D & tọa độ $Oxyz$, xác suất nâng cao (sơ đồ cây, công thức Bayes) và hệ thống tính toán đại số (CAS).

---

## 2. Hệ thống Nhập liệu & Ký hiệu Toán học (Lớp 1–12)

### 2.1. Trình soạn thảo công thức (WYSIWYG + LaTeX)
* Cho phép nhập công thức trực tiếp trên bảng trắng bằng cả **bàn phím ảo trực quan** lẫn **cú pháp LaTeX** nhanh.
* Hỗ trợ đầy đủ cấu trúc toán học:
  * Phân số ($\frac{a}{b}$), hỗn số, căn bậc hai ($\sqrt{x}$), căn bậc $n$ ($\sqrt[n]{x}$), lũy thừa ($a^n$), chỉ số dưới ($u_n$).
  * Hệ phương trình (dấu ngoặc nhọn), phương trình tuyển (dấu ngoặc vuông), giá trị tuyệt đối ($|x|$).
  * Giải tích: giới hạn ($\lim$), tổng ($\sum$), tích phân xác định và nguyên hàm ($\int_a^b$), đạo hàm ($f'(x), y''$).
  * Tổ hợp – Xác suất: $C_n^k, A_n^k, P_n, n!$.
  * Hình học & Tập hợp: vectơ ($\vec{a}, \overrightarrow{AB}$), ký hiệu góc ($\widehat{ABC}$), cung tròn, tam giác ($\triangle$), vuông góc ($\perp$), song song ($\parallel$), đồng dạng ($\sim$), tập hợp ($\in, \notin, \subset, \cup, \cap, \setminus, \emptyset, \forall, \exists$).

### 2.2. Nhận diện chữ viết tay sang công thức (Math Ink-to-Text)
* Người dùng viết tay biểu thức bằng chuột hoặc bút cảm ứng, dùng công cụ chọn khoanh vùng nét vẽ và bấm **"Chuyển thành công thức"**.
* Hệ thống gửi vùng nét vẽ qua AI nhận diện để chuyển thành đối tượng công thức LaTeX sắc nét, có thể tiếp tục chỉnh sửa hoặc đưa vào khung vẽ đồ thị.

### 2.3. Bảng ký hiệu động theo cấp học
* **Tiểu học:** Chỉ hiển thị $+, -, \times, :, =, <, >, \le, \ge$, phân số và đơn vị đo.
* **THCS:** Bổ sung $\sqrt{}, x^n, \pi, \approx, \perp, \parallel, \triangle, \sim$, ký hiệu góc và hệ phương trình.
* **THPT:** Mở toàn bộ lượng giác ($\sin, \cos, \tan, \cot$), logarit ($\log_a b, \ln$), đạo hàm, tích phân, vectơ và xác suất.

---

## 3. Phân hệ Tiểu học: Học cụ Trực quan Tương tác (Lớp 1–5)

Các đối tượng dạng **Manipulatives** có thể kéo-thả, nhân bản, tách/gộp trực tiếp trên bảng:

* **Khối cấu tạo số (Base-10 Blocks):**
  * Gồm 4 cấp: Khối đơn vị ($1$), thanh chục ($10$), tấm trăm ($100$), khối nghìn ($1000$).
  * Hỗ trợ cơ chế **Gộp (Group)** và **Tách (Ungroup)** thông minh: kéo $10$ ô đơn vị lại gần nhau tự động nhập thành $1$ thanh chục; bấm "Tách" vào thanh chục sẽ bung ra $10$ ô đơn vị (minh họa phép cộng có nhớ và trừ có mượn).
* **Khung 10 ô (Ten-Frames), Que tính & Bàn tính:** Kéo thả chấm tròn nhiều màu để dạy đếm, tách – gộp số trong phạm vi $10, 20$ (Lớp 1–2).
* **Khung "Đặt tính rồi tính" (Vertical Arithmetic Grid):**
  * Lưới căn thẳng hàng đơn vị, chục, trăm, nghìn kèm đường kẻ ngang và các ô nhỏ phía trên để ghi số nhớ.
  * Hỗ trợ riêng **khung đặt tính phép chia (hình chữ T)** theo đúng quy chuẩn trình bày của SGK Việt Nam.
* **Sơ đồ đoạn thẳng (Bar Model / Tape Diagram):**
  * Chuyên dụng cho bài toán có lời văn (Tổng – Hiệu, Tổng – Tỉ, Hiệu – Tỉ, toán chuyển động).
  * Tự động chia đoạn thẳng thành $n$ phần bằng nhau, gắn dấu ngoặc nhọn biểu diễn tổng/hiệu và hộp nhãn ghi số liệu.
* **Mô hình Phân số trực quan (Fraction Bars & Circles):**
  * Dạng hình tròn (chiếc bánh) và thanh chữ nhật, chia linh hoạt từ $2$ đến $20$ phần bằng nhau.
  * Cho phép tô màu từng miếng, kéo chồng lên nhau để so sánh và minh họa quy đồng/rút gọn phân số.
* **Trục số có bước nhảy (Number Line):**
  * Hỗ trợ số tự nhiên, phân số và số thập phân.
  * Kéo vẽ cung tròn mũi tên "nhảy cóc" (ví dụ $+3, -5$) để trực quan hóa phép tính và quy tắc làm tròn số.
* **Đồng hồ kim, Tiền tệ & Bảng đơn vị đo:**
  * Đồng hồ kéo xoay được kim giờ/phút (chế độ chạy đồng bộ thực tế hoặc chỉnh độc lập) hiển thị song song với đồng hồ điện tử $24$ giờ.
  * Bộ hình ảnh tiền Việt Nam (mệnh giá thực tế) phục vụ bài toán mua bán.
  * Thước/bảng chuyển đổi đơn vị đo độ dài, khối lượng, diện tích, thể tích.

---

## 4. Phân hệ Hình học Phẳng Động & Dụng cụ Đo vẽ (Lớp 1–12)

Kết hợp song song hai chế độ: **mô phỏng dụng cụ đo vẽ trên giấy** và **dựng hình động có ràng buộc toán học**.

### 4.1. Bộ dụng cụ vẽ ảo tương tác (Virtual Geometry Tools)
* **Thước kẻ thẳng:** Chia vạch $\text{cm}/\text{mm}$ chính xác, xoay góc tự do (hiển thị số đo góc nghiêng); khi đưa bút vẽ sát mép thước, nét vẽ tự động hít thẳng tắp (edge snapping).
* **Thước Ê-ke:** Dựng nhanh góc vuông $90^\circ$ và trượt dọc mép thước để vẽ đường thẳng song song.
* **Thước đo độ (Protractor):** Trong suốt, tự động bắt dính tâm vào đỉnh góc để đo và đọc số đo góc trực quan.
* **Compa ảo:** Cắm mũi kim cố định vào một điểm làm tâm, kéo mở khẩu độ theo bán kính $R$ mong muốn rồi xoay vẽ cung tròn hoặc đường tròn hoàn chỉnh.

### 4.2. Dựng hình động có ràng buộc (Dynamic Geometry)
* **Đối tượng dựng hình:** Điểm, đoạn thẳng, tia, đường thẳng, đường tròn, đa giác đều, tam giác đặc biệt (vuông, cân, đều), hình thang, hình bình hành, hình thoi, ba đường Conic (Elip, Parabol, Hypebol).
* **Quan hệ ràng buộc tự động:** Dựng trung điểm, đường trung trực, phân giác, đường cao, đường thẳng song song/vuông góc, tiếp tuyến, giao điểm tự động bắt dính. Khi di chuyển một đỉnh bất kỳ, các điểm đặc biệt (trọng tâm, trực tâm, tâm đường tròn ngoại tiếp/nội tiếp) tự động cập nhật theo thời gian thực.
* **Ký hiệu hình học chuẩn SGK:** Bấm chọn cạnh hoặc góc để gắn nhanh ký hiệu góc vuông, đánh dấu các cạnh bằng nhau ($1, 2, 3$ gạch), các góc bằng nhau ($1, 2$ cung hoặc cung có gạch), mũi tên chỉ hai đường thẳng song song.
* **Đo đạc tự động:** Hiển thị động độ dài cạnh, số đo góc, chu vi và diện tích ngay trên hình vẽ.
* **Phép biến hình (Lớp 11):** Mô phỏng có hoạt ảnh (animation) phép tịnh tiến theo vectơ $\vec{v}$, đối xứng trục, đối xứng tâm, phép quay tâm $O$ góc $\alpha$ và phép vị tự tâm $I$ tỉ số $k$.

---

## 5. Phân hệ Đại số, Giải tích & Đồ thị (Lớp 6–12)

### 5.1. Khung vẽ Đồ thị hàm số (Graphing Widget)
* Vẽ tức thì mọi loại hàm số: bậc nhất, bậc hai, bậc ba, trùng phương, phân thức bậc nhất/bậc nhất, bậc hai/bậc nhất, hàm mũ, logarit, lượng giác, hàm chứa dấu giá trị tuyệt đối và miền nghiệm hệ bất phương trình bậc nhất hai ẩn.
* **Thanh trượt tham số ($m, a, b, c$):** Khi nhập hàm có chứa tham số (ví dụ $y = x^3 - 3mx + 1$), tự động tạo thanh kéo điều chỉnh giá trị tham số để quan sát sự biến thiên và số giao điểm theo thời gian thực.
* **Điểm đặc biệt & Tiệm cận:** Tự động tính và hiển thị chấm tọa độ cực đại, cực tiểu, giao điểm với trục $Ox, Oy$, giao điểm hai đồ thị, và vẽ nét đứt cho tiệm cận đứng, tiệm cận ngang, tiệm cận xiên.
* **Ứng dụng tích phân (Lớp 12):** Cho phép chọn hai đường cong $f(x), g(x)$ và cận $[a; b]$ để tự động tô sọc hình phẳng giới hạn, đồng thời hiển thị diện tích hình phẳng $S$ và thể tích khối tròn xoay $V$.

### 5.2. Trình tạo Bảng biến thiên & Bảng xét dấu (Đặc thù THPT Việt Nam)
* Widget bảng chuyên biệt gồm các hàng chuẩn $x$, $y'$ (hoặc $f'(x)$), $y$ (hoặc $f(x)$).
* Hỗ trợ **2 chế độ**:
  1. *Tự động sinh:* Nhập biểu thức hàm số để tự tính đạo hàm, nghiệm, dấu và vẽ bảng biến thiên.
  2. *Soạn thảo tay siêu tốc:* Bấm nút chèn nhanh dấu $+$, $-$, số $0$, ký hiệu hai gạch đứng không xác định ($\parallel$), mũi tên đồng biến ($\nearrow$), nghịch biến ($\searrow$), giá trị vô cực ($\pm\infty$) và các điểm cực trị.

### 5.3. Trục số xét dấu & Tập hợp (Lớp 10–12)
* Vẽ nhanh trục số ngang, đánh dấu các mốc nghiệm, chèn ngoặc tròn `(` `)` và ngoặc vuông `[` `]`.
* Tự động kẻ gạch chéo bỏ phần không thuộc tập hợp; cho phép xếp chồng $2$–$3$ trục số để minh họa phép giao ($\cap$), hợp ($\cup$), hiệu ($\setminus$) tập hợp.

### 5.4. Vòng tròn lượng giác tương tác (Lớp 10–11)
* Kéo điểm ngọn $M$ chạy trên đường tròn đơn vị (chuyển đổi linh hoạt giữa Độ và Radian).
* Tự động gióng nét đứt xuống trục $\cos$ (hoành), trục $\sin$ (tung), trục $\tan$ và $\cot$ kèm giá trị chính xác dạng phân số/căn thức (như $\frac{\sqrt{2}}{2}, \frac{\sqrt{3}}{2}$).
* Hỗ trợ biểu diễn các điểm ngọn của họ nghiệm lượng giác (ví dụ $x = \frac{\pi}{6} + k\frac{\pi}{2}$).

### 5.5. Công cụ Đại số bổ trợ & CAS nhúng
* **Sơ đồ cây phân tích (Lớp 6):** Tự động tách một số tự nhiên thành thừa số nguyên tố dạng sơ đồ cây và tìm $\text{ƯCLN}, \text{BCNN}$.
* **Lõi tính toán đại số (CAS):** Chọn bất kỳ biểu thức nào trên bảng để thực hiện nhanh: Rút gọn, phân tích đa thức thành nhân tử, khai triển hằng đẳng thức, giải phương trình/hệ phương trình, tính đạo hàm và nguyên hàm kiểm chứng đáp án.

---

## 6. Phân hệ Hình học Không gian 3D & Tọa độ $Oxyz$ (Lớp 5, 7, 8, 9, 11, 12)

Đặt dưới dạng một **3D Viewport Widget** tương tác ngay trên bề mặt bảng trắng:

* **Thư viện khối đa diện & tròn xoay chuẩn:**
  * Hình chóp (tam giác, tứ giác, chóp đều, chóp có cạnh bên vuông góc với đáy), tứ diện đều, hình lăng trụ (đứng, xiên, tam giác, tứ giác), hình hộp chữ nhật, hình lập phương.
  * Hình trụ, hình nón, hình nón cụt, hình cầu và các tổ hợp ngoại tiếp/nội tiếp.
* **Tự động xử lý Nét liền – Nét đứt (Hidden-Line Dashed Rendering):**
  * Khi người dùng xoay khối 3D bằng chuột để tìm góc nhìn trực quan nhất, hệ thống tự động tính mặt khuất và chuyển cạnh bị che thành **nét đứt**, cạnh nhìn thấy thành **nét liền**.
  * Nút **"Chụp sang 2D (Snapshot to Canvas)"**: Biến góc nhìn 3D hiện tại thành hình vẽ vector sắc nét ngay trên bảng để giáo viên viết, tô màu, ghi chú trực tiếp đè lên.
* **Công cụ Thiết diện, Góc & Khoảng cách (Lớp 11):**
  * Chọn $3$ điểm hoặc một mặt phẳng cắt qua khối đa diện để tự động tính toán và tô màu trong suốt đa giác thiết diện.
  * Hỗ trợ dựng hình chiếu vuông góc, đường vuông góc chung, hiển thị góc giữa đường thẳng với mặt phẳng và góc nhị diện.
* **Trải hình 3D sang 2D (Nets / Unfolding – Lớp 5, 7, 8):**
  * Thanh trượt từ $0\%$ đến $100\%$ cho phép mở bung các mặt bên và đáy của hình lập phương, lăng trụ, hình chóp, hình trụ, hình nón ra mặt phẳng 2D giúp học sinh hiểu bản chất công thức diện tích xung quanh và diện tích toàn phần.
* **Hệ trục tọa độ không gian $Oxyz$ (Lớp 12):**
  * Nhập tọa độ điểm $A(x; y; z)$, vectơ $\vec{u}$, phương trình mặt phẳng $Ax + By + Cz + D = 0$, phương trình đường thẳng và phương trình mặt cầu để hiển thị trực quan và xoay $360^\circ$.

---

## 7. Phân hệ Xác suất & Thống kê (Lớp 6–12)

* **Bảng số liệu & Biểu đồ tự động:**
  * Nhập bảng giá trị rời rạc hoặc bảng tần số ghép nhóm $[a_i; a_{i+1})$.
  * Tự động vẽ: Biểu đồ tranh (Tiểu học), biểu đồ cột, cột kép, quạt tròn, đoạn thẳng, biểu đồ tần số ghép nhóm (Histogram) và biểu đồ hộp (Box Plot).
* **Tự động tính các số đặc trưng mẫu số liệu:**
  * Xuất nhanh bảng kết quả gồm: Số trung bình ($\bar{x}$), trung vị ($M_e$), các tứ phân vị ($Q_1, Q_2, Q_3$), mốt ($M_o$), khoảng biến thiên ($R$), khoảng tứ phân vị ($\Delta_Q$), phương sai ($s^2$) và độ lệch chuẩn ($s$).
* **Phòng thí nghiệm mô phỏng xác suất:**
  * Các mô-đun chạy trực tiếp trên bảng: Tung đồng xu, gieo $1$–$2$ con xúc xắc, vòng quay chia phần tùy chỉnh, rút bi (có hoàn lại / không hoàn lại).
  * Nút bấm mô phỏng nhanh $10$, $100$, $1000$ phép thử kèm biểu đồ cột tần suất thực nghiệm cập nhật liên tục để đối chiếu với xác suất lý thuyết.
* **Sơ đồ hình cây (Tree Diagram) & Biểu đồ Ven:**
  * *Sơ đồ cây:* Bấm thêm nhánh cấp $1, 2, 3$, điền xác suất lên từng nhánh, hệ thống tự nhân xác suất ở cuối mỗi nhánh (phục vụ quy tắc nhân, xác suất có điều kiện $P(A|B)$ và công thức Bayes Lớp 12).
  * *Biểu đồ Ven:* Dựng nhanh $2$ hoặc $3$ vòng tròn giao nhau, bấm tô màu từng vùng để minh họa tập hợp và nguyên lý bù trừ.

---

## 8. Tiện ích Sư phạm & Trình bày Bài giảng Toán

* **Nền bảng Toán học chuyên dụng:**
  * Ngoài nền trắng/tối, chấm bi và ô ly cơ bản, bổ sung thêm: **Nền hệ trục tọa độ $Oxy$** (tùy chỉnh ẩn/hiện số chia), **Nền lưới tam giác đều (Isometric Grid)** hỗ trợ vẽ tay hình không gian 3D cân đối, và **Nền lưới tọa độ cực (Polar Grid)**.
* **Máy tính bỏ túi khoa học nhúng (Virtual Scientific Calculator):**
  * Cửa sổ nổi có thể kéo di chuyển và phóng to/thu nhỏ, mô phỏng giao diện và phím bấm tương tự các dòng máy tính phổ biến trong nhà trường (hỗ trợ phân số, giải phương trình/hệ, tạo bảng giá trị TABLE, tính toán số phức/vectơ/thống kê) để hướng dẫn học sinh thao tác bấm máy ngay trong giờ giảng.
* **Khung ghim đề bài (Sticky Problem Viewer):**
  * Cho phép cắt (crop) một câu hỏi từ ảnh hoặc trang PDF rồi ghim cố định ở mép trên màn hình. Khi người dùng kéo bảng xuống sâu để viết lời giải nhiều trang, đề bài vẫn luôn hiển thị rõ ràng.
* **Rèm che lời giải từng bước (Step-by-Step Reveal):**
  * Đặt các thanh phủ mờ che từng dòng lập luận hoặc đáp số; khi giảng bài, bấm vào từng khung để mở hé lộ dần nội dung.
* **Sổ tay công thức kéo-thả (Formula Dock):**
  * Ngăn kéo tổng hợp công thức theo từng lớp/chương (7 hằng đẳng thức, công thức lượng giác, bảng đạo hàm – nguyên hàm, công thức thể tích khối đa diện...). Kéo một thẻ từ ngăn kéo thả lên bảng để làm ghi chú tham khảo nhanh cạnh bài làm.

---

## 9. Kiến trúc Kỹ thuật & Thư viện Mã nguồn mở Đề xuất

Mỗi phân hệ toán học nên được thiết kế như một **Math Widget độc lập** (Plugin Architecture) có thể đặt lên Infinite Canvas dưới dạng đối tượng tương tác (HTML/WebGL Overlay) và xuất được sang ảnh tĩnh khi Export PNG/PDF:

| Phân hệ chức năng | Thư viện Web đề xuất | Lý do lựa chọn |
| :--- | :--- | :--- |
| **Soạn thảo & Render công thức** | `mathlive` + `katex` | MathLive cung cấp ô nhập WYSIWYG và bàn phím toán ảo đẹp mắt; KaTeX hiển thị công thức siêu nhẹ và sắc nét. |
| **Đồ thị 2D & Hình học động** | `mafs` (React) hoặc `jsxgraph` | Mafs có trải nghiệm kéo thả tham số mượt mà như Desmos; JSXGraph cực mạnh về dựng hình có ràng buộc toán học. |
| **Hình học Không gian 3D** | `three` + `@react-three/fiber` + `@react-three/drei` | Dựng khối đa diện, xử lý thuật toán cạnh khuất nét đứt, cắt thiết diện và hoạt ảnh trải hình 3D mượt trên WebGL. |
| **Lõi tính toán đại số (CAS)** | `mathjs` kết hợp `nerdamer` (hoặc `algebrite`) | Chạy trực tiếp trên trình duyệt (client-side), hỗ trợ rút gọn, giải phương trình, tính đạo hàm/tích phân để tự sinh bảng biến thiên. |
| **Biểu đồ & Thống kê** | `echarts` (Apache ECharts) hoặc `chart.js` | Hỗ trợ đầy đủ biểu đồ cột, quạt tròn, histogram và box plot với hiệu ứng trực quan. |
| **Nhận diện chữ viết tay Toán** | **Gemini Multimodal API** | Chụp vùng nét vẽ (base64 PNG) trên canvas gửi lên model để chuyển chính xác sang chuỗi LaTeX. |

---

## 10. Lộ trình Tích hợp vào Dự án (Gợi ý cho Antigravity)

Thay vì xây toàn bộ 8 phân hệ cùng lúc, nên triển khai theo 4 cột mốc tiếp nối sau khi hoàn thành lõi bảng trắng cơ bản (`whiteboard_blueprint.md`):

1. **Math Phase 1 (Nền tảng dùng chung Lớp 1–12):**
   * Tích hợp **Grade Mode Switcher** (Tiểu học / THCS / THPT).
   * Tích hợp nền bảng hệ trục $Oxy$ và lưới Isometric 3D.
   * Tích hợp **MathLive + KaTeX** để gõ công thức toán ngay trên bảng, kèm **Sổ tay công thức kéo-thả** và **Khung ghim đề bài**.
2. **Math Phase 2 (Hình học & Dụng cụ đo vẽ):**
   * Xây dựng bộ dụng cụ ảo tương tác: **Thước kẻ (có edge snapping), Ê-ke, Thước đo độ, Compa**.
   * Xây dựng công cụ gắn ký hiệu hình học (góc vuông, cạnh bằng nhau, góc bằng nhau) và dựng hình phẳng động cơ bản.
3. **Math Phase 3 (Đại số, Giải tích & Không gian 3D - Trọng tâm THCS/THPT):**
   * Tích hợp **Graphing Widget** (vẽ đồ thị, thanh trượt tham số $m$, tô miền tích phân).
   * Xây dựng **Trình tạo Bảng biến thiên**, **Trục số xét dấu** và **Vòng tròn lượng giác**.
   * Tích hợp **3D Viewport Widget** (thư viện khối chóp/lăng trụ/tròn xoay, tự động nét đứt, chụp sang 2D, trải hình Nets và hệ tọa độ $Oxyz$).
4. **Math Phase 4 (Tiểu học, Xác suất – Thống kê & AI):**
   * Xây dựng bộ **Manipulatives Tiểu học** (Base-10 Blocks, khung đặt tính, sơ đồ đoạn thẳng, phân số, đồng hồ).
   * Xây dựng **Biểu đồ thống kê, Sơ đồ cây xác suất, Biểu đồ Ven** và mô phỏng tung xúc xắc/đồng xu.
   * Tích hợp **Math Ink-to-Text** (nhận diện chữ viết tay sang LaTeX) và **Máy tính khoa học ảo**.
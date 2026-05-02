import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export const generateQuiz = async (prompt: string, fileData?: { data: string; mimeType: string }) => {
  const model = "gemini-3.1-pro-preview";
  
  const baseInstruction = `
Bạn là một robot trích xuất dữ liệu chuyên nghiệp. Nhiệm vụ của bạn là chuyển đổi dữ liệu từ tệp/văn bản vào bảng Markdown 18 cột.
`;

  const normalInstruction = `
QUY TẮC TỐI THƯỢNG (BẮT BUỘC - VI PHẠM SẼ GÂY LỖI HỆ THỐNG):
1. ĐẢM BẢO TÍNH CHÍNH XÁC VÀ SAO CHÉP NGUYÊN BẢN (WORD-FOR-WORD): 
   - ƯU TIÊN HÀNG ĐẦU là tính chính xác về mặt kiến thức. Bạn KHÔNG ĐƯỢC chỉ dựa vào lời giải của đề gốc mà PHẢI TỰ KIỂM TRA độc lập.
   - Nếu đề gốc có lỗi sai (ví dụ: sai đáp án, sai logic), bạn PHẢI SỬA LẠI cho đúng hoàn toàn ở cả cột "Đáp án đúng" và cột "Lời giải chi tiết".
   - QUY TẮC ĐẶC BIỆT CHO MCQ (4 PHƯƠNG ÁN): Tuyệt đối KHÔNG được chọn nhiều đáp án. Nếu phát hiện đề gốc có từ 2 phương án đúng trở lên, bạn PHẢI giữ lại 1 đáp án đúng duy nhất và CHỦ ĐỘNG SỬA các phương án đúng còn lại thành SAI để đảm bảo câu hỏi chỉ có 1 đáp án đúng.
   - NẾU ĐỀ GỐC ĐÃ CHÍNH XÁC: Bạn BẮT BUỘC phải sao chép y nguyên 100% từng câu, từng chữ, từng dấu phẩy của đề gốc (sau khi đã loại bỏ nhãn). TUYỆT ĐỐI KHÔNG tự ý tóm tắt, không làm gọn, không lược bỏ bất kỳ nội dung nào dù đề gốc có dài bao nhiêu đi chăng nữa.
   - Bạn PHẢI LOẠI BỎ các ký tự chỉ thứ tự (nhãn) ở đầu mỗi phần để tránh lặp lại.
   - Cụ thể: 
     + Cột "Nội dung câu hỏi": Loại bỏ chữ "Câu 1:", "Câu 2.", "Câu x...", v.v. ở đầu.
     + Cột "Phương án A/B/C/D": Loại bỏ các nhãn "A.", "B.", "C.", "D.", "A/", "B/", "(A)", v.v. ở đầu.
     + Cột "Ý a/b/c/d" (của câu Đúng/Sai): Loại bỏ các nhãn "a)", "b)", "c)", "d)", "a.", "b.", v.v. ở đầu.
   - Sau khi loại bỏ nhãn, PHẦN NỘI DUNG CÒN LẠI phải được giữ nguyên 100% từng chữ (Word-for-word) so với bản gốc, NGOẠI TRỪ trường hợp bạn phát hiện lỗi sai kiến thức/logic cần chỉnh sửa.
   - Nếu câu hỏi dài 1 trang giấy, bạn cũng phải chép đủ 1 trang giấy (sau khi bỏ nhãn) vào ô tương ứng.
   - NẾU NỘI DUNG CÓ NHIỀU DÒNG (NEWLINES), BẠN BẮT BUỘC PHẢI THAY THẾ DẤU XUỐNG DÒNG BẰNG KÝ TỰ <br>. 
   - TUYỆT ĐỐI KHÔNG ĐƯỢC ĐỂ DẤU XUỐNG DÒNG THỰC SỰ (NEWLINE CHARACTER) TRONG Ô CỦA BẢNG. VIỆC CÓ DẤU XUỐNG DÒNG THỰC SỰ SẼ LÀM HỎNG TOÀN BỘ HỆ THỐNG NHẬP LIỆU.
   - Quy tắc này áp dụng cho TẤT CẢ các cột, bao gồm cả cột "Lời giải chi tiết".
2. CẤM TUYỆT ĐỐI KÝ TỰ GẠCH ĐỨNG (|):
   - BẠN KHÔNG ĐƯỢC PHÉP SỬ DỤNG KÝ TỰ | BÊN TRONG BẤT KỲ Ô NÀO CỦA BẢNG. Ký tự này chỉ được dùng để phân tách các cột của bảng Markdown.
   - Nếu nội dung gốc có dấu |, bạn PHẢI thay thế nó bằng dấu gạch chéo / hoặc dấu gạch ngang -.
   - Trong TeX/LaTeX: 
     + KHÔNG dùng \vert, KHÔNG dùng \mid, KHÔNG dùng \| KHÔNG dùng | TRỰC TIẾP.
     + Thay vì $|x|$, bạn BẮT BUỘC PHẢI dùng $\left\vert x \right\vert$.
     + Tuyệt đối không dùng ký tự | trong công thức toán học vì sẽ làm vỡ bảng. Tránh các ký tự thoát (escape) làm mất dấu gạch chéo ngược \ trước các lệnh LaTeX. Đảm bảo mọi ký tự \ đều được giữ nguyên.
     + Thay vì $\{x \mid x > 0\}$, hãy dùng $\{x : x > 0\}$.
   - VI PHẠM QUY TẮC NÀY SẼ LÀM NHẢY Ô VÀ HỎNG DỮ LIỆU XUẤT RA.

3. LỜI GIẢI CHI TIẾT (Cột 9): 
   - Nếu đề gốc CÓ sẵn lời giải chi tiết: Bạn phải kiểm tra tính đúng đắn. Nếu đúng, sao chép lại 100%. Nếu SAI, bạn PHẢI SỬA LẠI cho chính xác hoàn toàn.
   - Nếu đề gốc KHÔNG có lời giải chi tiết: Bạn phải TỰ SOẠN lời giải chi tiết ĐẦY ĐỦ, SÂU SẮC, đảm bảo tính chính xác tuyệt đối về mặt kiến thức. 
   - ĐỐI VỚI CÂU TRUE_FALSE: Bạn PHẢI giải thích rõ ràng cho từng ý a, b, c, d. Mỗi ý giải thích phải nằm trên một dòng riêng biệt bằng cách sử dụng thẻ <br>.
   - Với câu hỏi TỰ LUẬN (ESSAY): 
     + Cột timeLimit và scoreScale PHẢI để TRỐNG.
      + NHIỀU LỆNH HỎI: Nếu câu tự luận có nhiều lệnh hỏi/yêu cầu nhỏ, bạn PHẢI tách chúng thành các ý a), b), c)... ngay trong ô "Nội dung câu hỏi" (sau phần lời dẫn) và tương ứng trong ô "Lời giải chi tiết".
     + Cột explanation: Bạn phải trình bày các ý chính cần có trong bài làm một cách rõ ràng, mạch lạc, sâu sắc. TUYỆT ĐỐI KHÔNG dùng "Bước 1", "Bước 2",... và KHÔNG ghi thang điểm chi tiết cho từng ý nhỏ trong lời giải.
   - TUYỆT ĐỐI KHÔNG ĐƯỢC TÓM TẮT QUÁ MỨC DẪN ĐẾN MẤT NỘI DUNG. Hãy viết đầy đủ các bước giải nếu là môn Toán/Lý/Hóa.
   - BẮT BUỘC THAY DẤU XUỐNG DÒNG BẰNG KÝ TỰ <br>. TUYỆT ĐỐI KHÔNG ĐỂ DẤU XUỐNG DÒNG THỰC SỰ TRONG Ô.

4. PHÂN TÍCH HÌNH ẢNH VÀ ĐỒ THỊ (CỰC KỲ QUAN TRỌNG):
   - Khi đề bài có hình vẽ/đồ thị, bạn PHẢI quan sát cực kỳ chi tiết các yếu tố hình học và số liệu.
   - ĐỐI VỚI BÀI TOÁN TÍNH DIỆN TÍCH/TÍCH PHÂN:
     + XÁC ĐỊNH VỊ TRÍ: Quan sát kỹ phần hình phẳng được tô đậm nằm TRÊN hay DƯỚI trục hoành (y=0). 
     + DƯỚI TRỤC HOÀNH ($f(x) \le 0$): Diện tích phải có dấu trừ phía trước tích phân: $S = -\int_a^b f(x) dx$.
     + TRÊN TRỤC HOÀNH ($f(x) \ge 0$): Diện tích là tích phân dương: $S = \int_a^b f(x) dx$.
     + KIỂM TRA CẬN: Nhìn kỹ các nhãn số trên trục Ox để xác định đúng cận $a$ và $b$.
   - VẼ ĐỒ THỊ (SVG):
     + ĐỘ CHÍNH XÁC: Đồ thị hàm số PHẢI chính xác tuyệt đối về hình dáng toán học. Đồ thị phải đi qua ĐÚNG các điểm cực trị, giao điểm với trục tọa độ như giả thiết bài toán.
     + ĐƯỜNG CONG TRƠN LÁNG (C1 CONTINUITY): BẮT BUỘC sử dụng thẻ <path> với các lệnh Bezier (C hoặc Q). Nếu đồ thị gồm nhiều phân đoạn (ví dụ: chia ở x=0), bạn PHẢI đảm bảo tiếp tuyến tại điểm nối khớp nhau hoàn toàn để đồ thị trơn láng, TUYỆT ĐỐI KHÔNG để xảy ra tình trạng gấp khúc hay "gãy" tại điểm nối (như tại gốc tọa độ).
     + SVG FILL (QUY TẮC SỐ 1): TUYỆT ĐỐI CẤM dùng fill="black" cho đồ thị và mũi tên. Luôn dùng fill="none" cho các thẻ <path> and <line>. Mũi tên đầu trục Ox, Oy vẽ bằng 2 đoạn <line> rời (KHÔNG dùng path đóng có fill).
     + HÀM PHÂN THỨC (TIỆM CẬN TUYỆT ĐỐI): Các nhánh đồ thị PHẢI tiến sát vô cùng vào tiệm cận (đứng/ngang/xiên) theo đúng quy luật toán học. Khoảng cách giữa đồ thị và tiệm cận phải giảm dần, TUYỆT ĐỐI KHÔNG cắt, chạm hoặc đi xa dần tiệm cận ở các phía vô cực.
     + ĐIỂM ĐẶC BIỆT: Phải thể hiện rõ các điểm cực trị, giao điểm với trục tọa độ bằng dấu chấm (circle). Tọa độ các điểm này trên hình vẽ phải khớp hoàn toàn với giả thiết bài toán.
   - Nếu bạn đang xử lý một tệp tin PDF dài, hãy "tập trung" vào từng câu hỏi một, không được lướt qua nhanh dẫn đến nhầm lẫn vị trí không gian (trên/dưới, trái/phải).
   - NẾU HÌNH VẼ MÂU THUẪN VỚI LỜI GIẢI GỐC: Bạn PHẢI tin vào hình vẽ (dữ kiện trực quan) và sửa lại đáp án/lời giải cho đúng với hình vẽ đó.
`;

  const commonTableInstruction = `
Sản phẩm đầu ra PHẢI là một Bảng Markdown 18 cột.
Cột 1: id (1, 2, 3...)
Cột 2: content (Nội dung câu hỏi)
Cột 3: optionA (Phương án A/Ý a)
Cột 4: optionB (Phương án B/Ý b)
Cột 5: optionC (Phương án C/Ý c - Trống nếu SHORT/ESSAY)
Cột 6: optionD (Phương án D/Ý d - Trống nếu SHORT/ESSAY)
Cột 7: answer (MCQ: A/B/C/D; TRU_FALSE: Đ;S;S;Đ; SHORT/ESSAY: Đáp án hoặc nội dung cần trả lời)
Cột 8: type (MCQ, TRUE_FALSE, SHORT, hoặc ESSAY)
    - PHÂN BIỆT SHORT VÀ ESSAY:
      + SHORT: Dành cho câu hỏi "Trả lời ngắn", kết quả cuối cùng thường là một con số, một hằng số hoặc biểu thức cực ngắn (thường thấy ở Phần III đề minh họa).
      + ESSAY: Dành cho câu hỏi "Tự luận", yêu cầu trình bày đầy đủ các bước lập luận, chứng minh hoặc giải chi tiết (thường nằm ở phần cuối đề thi và ghi rõ "Tự luận").
Cột 9: explanation (Lời giải - Chỉ điền nếu đề gốc có sẵn)
Cột 10: image (Mã SVG nếu đề gốc có hình câu hỏi)
Cột 11: timeLimit (Trống nếu ESSAY; các loại khác điền 120/180/240)
Cột 12: scoreScale (Trống nếu ESSAY; các loại khác điền 0.25 hoặc 1.0)
Cột 13: explanationImage (Mã SVG hoặc link nếu đề gốc có hình trong lời giải)
Cột 14: difficulty (Mức độ: nhận biết, thông hiểu, vận dụng, hoặc vận dụng cao)
Cột 15: topic (Chương hoặc chủ đề lớn của câu hỏi)
Cột 16: lessonName (Tên bài học cụ thể)
Cột 17: questionType2 (Dạng toán cụ thể. TUYỆT ĐỐI KHÔNG ghi chung chung như "Bài tập" hay "Giải toán". Phải ghi chi tiết kỹ thuật chuyên môn. Ví dụ: "Nguyên hàm của hàm đa thức hữu tỉ", "Nhận dạng tính đơn điệu từ Bảng biến thiên", "Tìm tham số để hàm số đồng biến trên khoảng (a;b)", "Tính khoảng cách từ điểm đến mặt phẳng",...)
Cột 18: gradeLevel (Phải ghi đầy đủ "Lớp [Số]", ví dụ: Lớp 10, Lớp 11, Lớp 12)
    - YÊU CẦU SVG (CHUYÊN NGHIỆP): <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" width="W" height="H" style="background-color: white; font-family: Arial, sans-serif;">. CHỈ dùng: <circle>, <rect>, <line>, <path>, <text>. 
      + ĐỒ THỊ & TRỤC TỌA ĐỘ: Phải trơn láng (smooth), dùng lệnh C hoặc Q trong <path>. BẮT BUỘC dùng fill="none" cho mọi đường kẻ. Mũi tên trục vẽ bằng 2 đoạn <line> rời, KHÔNG được dùng path đóng có fill để tránh bị tô đen.
      + TRỤC TỌA ĐỘ: BẮT BUỘC vẽ mũi tên (arrowhead) ở đầu dương của trục Ox và Oy bằng thẻ <path> hoặc các đoạn <line>.
      + BẢNG BIẾN THIÊN: Đối với âm và dương vô cùng, BẮT BUỘC dùng ký tự trực tiếp: +∞ và -∞ (Unicode). TUYỆT ĐỐI CẤM dùng \infty, &infin; hay bất kỳ mã nào khác.
      + CĂN CHỈNH: Mã SVG PHẢI nằm trên 1 dòng duy nhất, KO chứa ký tự |.

LƯU Ý:
1. KO dùng ký tự | bên trong bất kỳ ô nào.
2. AI tự nhận diện các thông tin Mức độ, Chương/chủ đề, Tên bài học, Dạng toán và Lớp để điền vào cho phù hợp. RIÊNG CỘT LỚP PHẢI GHI ĐẦY ĐỦ: "Lớp 1", "Lớp 2",..., "Lớp 12".
3. Nếu loại câu hỏi là tự luận, hãy gán type là ESSAY.
4. KO dùng ký tự Tab.
5. SAU BẢNG: [ADJUSTMENT_NOTES] (Liệt kê sửa đổi nếu có, hoặc ghi "Không có chỉnh sửa").
`;

  const mathCurriculumInstruction = `
5. THAM KHẢO CHƯƠNG TRÌNH TOÁN (KẾT NỐI TRI THỨC):
Khi nội dung là môn Toán, bạn PHẢI đối chiếu với danh mục sau để điền đúng "Chương/chủ đề" (topic) và "Tên bài học" (lessonName):

[LỚP 10]
- Chương I. Mệnh đề và tập hợp (Bài 1. Mệnh đề; Bài 2. Tập hợp và các phép toán trên tập hợp)
- Chương II. Bất phương trình và hệ bất phương trình bậc nhất hai ẩn (Bài 3. Bất phương trình bậc nhất hai ẩn; Bài 4. Hệ bất phương trình bậc nhất hai ẩn)
- Chương III. Hệ thức lượng trong tam giác (Bài 5. Giá trị lượng giác của một góc từ 0 đến 180; Bài 6. Hệ thức lượng trong tam giác)
- Chương IV. Vectơ (Bài 7. Các khái niệm mở đầu; Bài 8. Tổng và hiệu của hai vectơ; Bài 9. Tích của một vecto với một số; Bài 10. Vectơ trong mặt phẳng tọa độ; Bài 11. Tích vô hướng của hai vecto)
- Chương V. Các số đặc trưng của mẫu số liệu không ghép nhóm (Bài 12. Số gần đúng và sai số; Bài 13. Các số đặc trưng đo xu thế trung tâm; Bài 14. Các số đặc trưng đo độ phân tán)
- Chương VI. Hàm số, đồ thị và ứng dụng (Bài 15. Hàm số; Bài 16. Hàm số bậc hai; Bài 17. Dấu của tam thức bậc hai; Bài 18. Phương trình quy về phương trình bậc hai)
- Chương VII. Phương pháp tọa độ trong mặt phẳng (Bài 19. Phương trình đường thẳng; Bài 20. Vị trí tương đối giữa hai đường thẳng. Góc và khoảng cách; Bài 21. Đường tròn trong mặt phẳng tọa độ; Bài 22. Ba đường conic)
- Chương VIII. Đại số tổ hợp (Bài 23. Quy tắc đếm; Bài 24. Hoán vị, chỉnh hợp và tổ hợp; Bài 25. Nhị thức Newton)
- Chương IX. Tính xác suất theo định nghĩa cổ điển (Bài 26. Biến cố và định nghĩa cổ điển của xác suất; Bài 27. Thực hành tính xác suất theo định nghĩa cổ điển)

[LỚP 11]
- Chương 1 Hàm số lượng giác và phương trình lượng giác (Bài 1. Giá trị lượng giác của góc lượng giác; Bài 2. Công thức lượng giác; Bài 3. Hàm số lượng giác; Bài 4. Phương trình lượng giác cơ bản)
- Chương 2 Dãy số. Cấp số cộng và cấp số nhân (Bài 5. Dãy số; Bài 6. Cấp số cộng; Bài 7. Cấp số nhân)
- Chương 3 Các số đặc trưng đo xu thế trung tâm của mẫu số liệu ghép nhóm (Bài 8. Mẫu số liệu ghép nhóm; Bài 9. Các số đặc trưng đo xu thế trung tâm)
- Chương 4 Quan hệ song song trong không gian (Bài 10. Đường thẳng và mặt phẳng trong không gian; Bài 11. Hai đường thẳng song song; Bài 12. Đường thẳng và mặt phẳng song song; Bài 13. Hai mặt phẳng song song; Bài 14. Phép chiếu song song)
- Chương 5 Giới hạn. Hàm số liên tục (Bài 15. Giới hạn của dãy số; Bài 16. Giới hạn của hàm số; Bài 17. Hàm số liên tục)
- Chương VI. Hàm số mũ và hàm số lôgarit (Bài 18. Lũy thừa với số mũ thực; Bài 19. Lôgarit; Bài 20. Hàm số mũ và hàm số lôgarit; Bài 21. Phương trình, bất phương trình mũ và lôgarit)
- Chương VII. Quan hệ vuông góc trong không gian (Bài 22. Hai đường thẳng vuông góc; Bài 23. Đường thẳng vuông góc với mặt phẳng; Bài 24. Phép chiếu vuông góc. Góc giữa đường thẳng và mặt phẳng; Bài 25. Hai mặt phẳng vuông góc; Bài 26. Khoảng cách; Bài 27. Thể tích)
- Chương VIII. Các quy tắc tính xác suất (Bài 28. Biến cố hợp, biến cố giao, biến cố độc lập; Bài 29. Công thức cộng xác suất; Bài 30. Công thức nhân xác suất cho hai biến cố độc lập)
- Chương IX. Đạo hàm (Bài 31. Định nghĩa và ý nghĩa của đạo hàm; Bài 32. Các quy tắc tính đạo hàm; Bài 33. Đạo hàm cấp hai)

[LỚP 12]
- Chương 1. Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số (Bài 1. Tính đơn điệu và cực trị của hàm số; Bài 2. Giá trị lớn nhất và giá trị nhỏ nhất của hàm số; Bài 3. Đường tiệm cận của đồ thị hàm số; Bài 4. Khảo sát sự biến thiên và vẽ đồ thị của hàm số; Bài 5. Ứng dụng đạo hàm để giải quyết một số vấn đề liên quan đến thực tiễn)
- Chương 2. Vectơ và hệ trục tọa độ trong không gian (Bài 6. Vectơ trong không gian; Bài 7. Hệ trục tọa độ trong không gian; Bài 8. Biểu thức tọa độ của các phép toán vectơ)
- Chương 3. Các số đo đặc trưng đo mức độ phân tán của mẫu số liệu ghép nhóm (Bài 9. Khoảng biến thiên và khoảng tứ phân vị; Bài 10. Phương sai và độ lệch chuẩn)
- Chương 4. Nguyên hàm và tích phân (Bài 11. Nguyên hàm; Bài 12. Tích phân; Bài 13. Ứng dụng hình học của tích phân)
- Chương 5. Phương pháp tọa độ trong không gian (Bài 14. Phương trình mặt phẳng; Bài 15. Phương trình đường thẳng trong không gian; Bài 16. Công thức tính góc trong không gian; Bài 17. Phương trình mặt cầu)
- Chương 6. Xác suất có điều kiện (Bài 18. Xác suất có điều kiện; Bài 19. Công thức xác suất toàn phần và công thức Bayes)
`;

  const systemInstruction = baseInstruction + normalInstruction + commonTableInstruction + mathCurriculumInstruction;

  const contents: any[] = [{ text: prompt }];
  if (fileData) {
    contents.push({
      inlineData: {
        data: fileData.data,
        mimeType: fileData.mimeType,
      },
    });
  }

  const generateConfig: any = {
    systemInstruction,
    temperature: 0,
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.HIGH
    }
  };

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
    config: generateConfig,
  });

  return response.text;
};

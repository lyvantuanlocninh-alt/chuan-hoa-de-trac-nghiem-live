import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Upload, 
  Send, 
  Copy, 
  Download, 
  Check, 
  AlertCircle, 
  Loader2, 
  Trash2,
  Table as TableIcon,
  ChevronRight,
  Info
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateQuiz } from './lib/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type GenerationMode = 'prompt' | 'file';

export default function App() {
  const [mode, setMode] = useState<GenerationMode>('prompt');
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setFileBase64(base64);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleGenerate = async () => {
    if (mode === 'prompt' && !prompt.trim()) {
      setError('Vui lòng nhập yêu cầu ra đề.');
      return;
    }
    if (mode === 'file' && !file) {
      setError('Vui lòng chọn tệp tin.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const fileData = file && fileBase64 ? { data: fileBase64, mimeType: file.type } : undefined;
      const response = await generateQuiz(prompt || 'Hãy tạo đề trắc nghiệm từ tệp tin này.', fileData);
      setResult(response || '');
    } catch (err: any) {
      console.error(err);
      setError('Đã xảy ra lỗi khi tạo đề. Vui lòng thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyForSheets = () => {
    if (!result) return;

    const lines = result.trim().split('\n');
    const tableLines = lines.filter(line => line.trim().startsWith('|'));
    
    if (tableLines.length < 3) return;

    const finalHeaders = [
      'Mã câu hỏi',
      'Nội dung câu hỏi',
      'Phương án A / Ý a',
      'Phương án B / Ý b',
      'Phương án C / Ý c',
      'Phương án D / Ý d',
      'Đáp án đúng',
      'Loại câu hỏi',
      'Lời giải chi tiết',
      'Link ảnh',
      'Giới hạn thời gian',
      'Thang điểm'
    ];

    const data = tableLines.slice(2).map(line => {
      const trimmedLine = line.trim();
      
      // Remove leading and trailing pipes
      let cleanLine = trimmedLine;
      if (cleanLine.startsWith('|')) cleanLine = cleanLine.substring(1);
      if (cleanLine.endsWith('|')) cleanLine = cleanLine.substring(0, cleanLine.length - 1);
      
      // Split by pipe
      const rawCells = cleanLine.split('|').map(c => c.trim());
      
      const processedCells = Array(12).fill('');
      
      if (rawCells.length === 12) {
        rawCells.forEach((cell, i) => processedCells[i] = cell);
      } else if (rawCells.length > 12) {
        // If there are more than 12 cells, it means some cells contained a '|' character.
        // We assume the extra pipes are in 'content' (index 1) or 'explanation' (index 8).
        // Strategy: 
        // 1. Take the first 1 column (id)
        processedCells[0] = rawCells[0];
        
        // 2. Take the last 3 columns (image, timeLimit, scoreScale)
        processedCells[11] = rawCells[rawCells.length - 1];
        processedCells[10] = rawCells[rawCells.length - 2];
        processedCells[9] = rawCells[rawCells.length - 3];
        
        // 3. Take the columns between id and explanation (content, optionA-D, answer, type)
        // These are 7 columns. But 'content' might have pipes.
        // Let's assume optionA-D, answer, type are usually simple and don't have pipes.
        // They are at the end of the "middle" section.
        processedCells[7] = rawCells[rawCells.length - 4]; // type
        processedCells[6] = rawCells[rawCells.length - 5]; // answer
        processedCells[5] = rawCells[rawCells.length - 6]; // optionD
        processedCells[4] = rawCells[rawCells.length - 7]; // optionC
        processedCells[3] = rawCells[rawCells.length - 8]; // optionB
        processedCells[2] = rawCells[rawCells.length - 9]; // optionA
        
        // 4. Everything between index 1 and the cell before optionA is 'content'
        const contentEndIndex = rawCells.length - 10;
        processedCells[1] = rawCells.slice(1, contentEndIndex + 1).join(' | ');
        
        // 5. Wait, we missed 'explanation' (index 8). Let's re-adjust.
        // Correct indices for 12 columns: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
        // Let's try again with a more reliable mapping:
        // First 1: id (index 0)
        // Last 3: image (9), timeLimit (10), scoreScale (11)
        // We have 8 columns left to fill (1 to 8).
        // Let's assume columns 2, 3, 4, 5, 6, 7 are "stable" (options, answer, type)
        // and pipes are in 1 (content) or 8 (explanation).
        
        // Re-parsing logic:
        processedCells[0] = rawCells[0]; // id
        processedCells[11] = rawCells[rawCells.length - 1]; // scoreScale
        processedCells[10] = rawCells[rawCells.length - 2]; // timeLimit
        processedCells[9] = rawCells[rawCells.length - 3]; // image
        processedCells[7] = rawCells[rawCells.length - 4]; // type
        processedCells[6] = rawCells[rawCells.length - 5]; // answer
        processedCells[5] = rawCells[rawCells.length - 6]; // optionD
        processedCells[4] = rawCells[rawCells.length - 7]; // optionC
        processedCells[3] = rawCells[rawCells.length - 8]; // optionB
        processedCells[2] = rawCells[rawCells.length - 9]; // optionA
        
        // Now we have index 1 and 8 left. And rawCells from index 1 to rawCells.length - 10.
        // This is still ambiguous if both have pipes. 
        // But usually 'explanation' is the one with the most text.
        // Let's assume index 1 is just one cell and join the rest into 8.
        processedCells[1] = rawCells[1];
        processedCells[8] = rawCells.slice(8, rawCells.length - 3).join(' | ');
        
        // Actually, let's just do a simple join for index 8 if length > 12 and we can't be sure.
        // The most common case is pipe in explanation.
        if (rawCells.length > 12) {
           // Reset and use a simpler heuristic: first 8 are 0-7, last 3 are last 3, middle is 8.
           for(let i=0; i<8; i++) processedCells[i] = rawCells[i];
           processedCells[11] = rawCells[rawCells.length - 1];
           processedCells[10] = rawCells[rawCells.length - 2];
           processedCells[9] = rawCells[rawCells.length - 3];
           processedCells[8] = rawCells.slice(8, rawCells.length - 3).join(' | ');
        }
      } else {
        rawCells.forEach((cell, i) => { if (i < 12) processedCells[i] = cell; });
      }

      // Final sanitization for TSV
      const rowData = processedCells.map((cell, index) => {
        // Remove tabs
        let sanitized = cell.replace(/\t/g, ' ');
        
        // Keep <br> as literal text, but remove any actual newlines that might have leaked
        // to ensure each question is strictly on one line.
        sanitized = sanitized.replace(/\r?\n/g, ' ');
        
        // If it's the answer column (index 6) and contains ';', replace with '|'
        if (index === 6 && sanitized.includes(';')) {
          return sanitized.replace(/;/g, '|');
        }
        return sanitized;
      });
      return rowData.join('\t');
    });

    const tsv = data.join('\n');
    navigator.clipboard.writeText(tsv);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleExportExcel = () => {
    if (!result) return;

    const lines = result.trim().split('\n');
    // Find the line that starts with | and contains headers
    const tableLines = lines.filter(line => line.trim().startsWith('|'));
    
    if (tableLines.length < 3) return;

    // The headers are in the first row of the table
    const rawHeaders = tableLines[0].split('|').map(h => h.trim()).filter(h => h !== '');
    
    // We want to use the exact headers from the user's template
    const finalHeaders = [
      'Mã câu hỏi',
      'Nội dung câu hỏi',
      'Phương án A / Ý a',
      'Phương án B / Ý b',
      'Phương án C / Ý c',
      'Phương án D / Ý d',
      'Đáp án đúng',
      'Loại câu hỏi',
      'Lời giải chi tiết',
      'Link ảnh',
      'Giới hạn thời gian',
      'Thang điểm'
    ];

    const data = tableLines.slice(2).map(line => {
      const trimmedLine = line.trim();
      
      // Remove leading and trailing pipes
      let cleanLine = trimmedLine;
      if (cleanLine.startsWith('|')) cleanLine = cleanLine.substring(1);
      if (cleanLine.endsWith('|')) cleanLine = cleanLine.substring(0, cleanLine.length - 1);
      
      // Split by pipe
      const rawCells = cleanLine.split('|').map(c => c.trim());
      
      const processedCells = Array(12).fill('');
      
      if (rawCells.length === 12) {
        rawCells.forEach((cell, i) => processedCells[i] = cell);
      } else if (rawCells.length > 12) {
        // Smart join for explanation column (index 8)
        for(let i=0; i<8; i++) processedCells[i] = rawCells[i] || '';
        processedCells[11] = rawCells[rawCells.length - 1] || '';
        processedCells[10] = rawCells[rawCells.length - 2] || '';
        processedCells[9] = rawCells[rawCells.length - 3] || '';
        processedCells[8] = rawCells.slice(8, rawCells.length - 3).join(' | ');
      } else {
        rawCells.forEach((cell, i) => { if (i < 12) processedCells[i] = cell; });
      }

      const row: any = {};
      finalHeaders.forEach((header, index) => {
        let value = processedCells[index] || '';
        // Sanitize: remove tabs
        value = value.replace(/\t/g, ' ');
        
        // Keep <br> as literal text, but remove any actual newlines that might have leaked
        value = value.replace(/\r?\n/g, ' ');
        
        // If it's the answer column (index 6) and contains ';', replace with '|'
        if (index === 6 && value.includes(';')) {
          value = value.replace(/;/g, '|');
        }
        row[header] = value;
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { header: finalHeaders, skipHeader: true });
    
    // Set column widths for better visibility
    const wscols = [
      { wch: 12 }, // Mã
      { wch: 50 }, // Nội dung
      { wch: 20 }, // A
      { wch: 20 }, // B
      { wch: 20 }, // C
      { wch: 20 }, // D
      { wch: 10 }, // Đáp án
      { wch: 12 }, // Loại
      { wch: 40 }, // Lời giải
      { wch: 20 }, // Link ảnh
      { wch: 15 }, // Thời gian
      { wch: 15 }  // Thang điểm
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'QuizSheet');
    XLSX.writeFile(workbook, 'quiz_bank_export.xlsx');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <TableIcon className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight">QuizSheet <span className="text-indigo-600">Generator</span></h1>
              <p className="text-xs text-slate-500 font-medium">Tạo nguồn đề trắc nghiệm chuyên nghiệp</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <a href="https://docs.google.com/spreadsheets" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-1">
              Google Sheets <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel: Controls */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-600" />
                Cấu hình ra đề
              </h2>

              {/* Mode Switcher */}
              <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
                <button
                  onClick={() => setMode('prompt')}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
                    mode === 'prompt' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <Send className="w-4 h-4" />
                  Yêu cầu
                </button>
                <button
                  onClick={() => setMode('file')}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
                    mode === 'file' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <FileText className="w-4 h-4" />
                  Tệp tin
                </button>
              </div>

              <div className="space-y-4">
                {mode === 'prompt' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Mô tả yêu cầu ra đề</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Ví dụ: Tạo 5 câu trắc nghiệm Toán lớp 12 về Đạo hàm, bao gồm 2 câu MCQ, 2 câu TRUE_FALSE và 1 câu SHORT..."
                      className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Tải lên tệp tin (PDF, Word, Ảnh)</label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
                          file ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                        )}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        />
                        {file ? (
                          <>
                            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                              <FileText className="text-indigo-600 w-6 h-6" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold text-slate-900 truncate max-w-[200px]">{file.name}</p>
                              <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setFile(null); setFileBase64(null); }}
                              className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Xóa tệp
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                              <Upload className="text-slate-400 w-6 h-6" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium text-slate-900">Nhấn để tải lên hoặc kéo thả</p>
                              <p className="text-xs text-slate-500">PDF, Word, PNG, JPG (Max 10MB)</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Ghi chú thêm (Tùy chọn)</label>
                      <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ví dụ: Chỉ lấy các câu hỏi về Hình học..."
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </motion.div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={cn(
                    "w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2",
                    isGenerating 
                      ? "bg-slate-400 cursor-not-allowed" 
                      : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-indigo-200"
                  )}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Bắt đầu tạo đề
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Guidelines */}
            <section className="bg-indigo-900 rounded-2xl p-6 text-indigo-100 shadow-xl">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Hướng dẫn sử dụng
              </h3>
              <ul className="text-sm space-y-3 opacity-90">
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-indigo-800 rounded-full flex items-center justify-center text-[10px] shrink-0">1</span>
                  <span>Chọn phương thức ra đề (Yêu cầu hoặc Tệp tin).</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-indigo-800 rounded-full flex items-center justify-center text-[10px] shrink-0">2</span>
                  <span>Nhấn "Bắt đầu tạo đề" và chờ kết quả.</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-indigo-800 rounded-full flex items-center justify-center text-[10px] shrink-0">3</span>
                  <span>Copy bảng Markdown hoặc Xuất file Excel để dán vào Google Sheets.</span>
                </li>
              </ul>
            </section>
          </div>

          {/* Right Panel: Result */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col min-h-[600px]">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="font-semibold flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-indigo-600" />
                  Kết quả đề trắc nghiệm
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyForSheets}
                    disabled={!result}
                    className={cn(
                      "p-2 rounded-lg transition-all flex items-center gap-1 text-sm font-medium",
                      result ? "hover:bg-slate-200 text-slate-700" : "text-slate-300 cursor-not-allowed"
                    )}
                    title="Copy cho Google Sheets (TSV)"
                  >
                    {copySuccess ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    {copySuccess ? "Đã copy" : "Copy cho Sheets"}
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={!result}
                    className={cn(
                      "p-2 rounded-lg transition-all flex items-center gap-1 text-sm font-medium",
                      result ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100" : "text-slate-300 cursor-not-allowed"
                    )}
                  >
                    <Download className="w-4 h-4" />
                    Xuất Excel
                  </button>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  {isGenerating ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4"
                    >
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-pulse text-indigo-600" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-slate-600">Đang phân tích và tạo đề...</p>
                        <p className="text-xs">Quá trình này có thể mất vài giây</p>
                      </div>
                    </motion.div>
                  ) : result ? (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2 text-amber-800 text-xs">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>
                          <strong>Lưu ý:</strong> Để tránh lỗi nhảy ô, đáp án Đúng/Sai được hiển thị tạm thời bằng dấu ";" trong bảng dưới đây. 
                          Khi bạn nhấn <strong>"Copy cho Sheets"</strong> hoặc <strong>"Xuất Excel"</strong>, hệ thống sẽ tự động chuyển về dấu "|" theo đúng yêu cầu.
                        </p>
                      </div>
                      <div className="markdown-body prose prose-slate max-w-none">
                        <ReactMarkdown 
                          rehypePlugins={[rehypeRaw, rehypeKatex]}
                          remarkPlugins={[remarkMath]}
                        >
                          {result}
                        </ReactMarkdown>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4"
                    >
                      <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center">
                        <TableIcon className="w-10 h-10" />
                      </div>
                      <p className="text-sm font-medium">Chưa có kết quả. Hãy bắt đầu tạo đề ở bảng bên trái.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-8 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-sm">
          <p>© 2026 QuizSheet Generator. Powered by Google Gemini.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-indigo-600 transition-colors">Điều khoản</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Bảo mật</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Liên hệ</a>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        
        .markdown-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.875rem;
        }
        .markdown-body th, .markdown-body td {
          border: 1px solid #e2e8f0;
          padding: 0.75rem;
          text-align: left;
        }
        .markdown-body th {
          background-color: #f8fafc;
          font-weight: 600;
          color: #475569;
        }
        .markdown-body tr:nth-child(even) {
          background-color: #fcfcfc;
        }
        .markdown-body tr:hover {
          background-color: #f1f5f9;
        }
      `}} />
    </div>
  );
}

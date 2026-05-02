import React, { useState, useRef, useEffect } from 'react';
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
  Info,
  FileText as FileDoc,
  Image as ImageIcon
} from 'lucide-react';
import JSZip from 'jszip';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
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
  const [mcqCount, setMcqCount] = useState<string>('5');
  const [tfCount, setTfCount] = useState<string>('0');
  const [shortCount, setShortCount] = useState<string>('0');
  const [essayCount, setEssayCount] = useState<string>('0');
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [adjustmentNotes, setAdjustmentNotes] = useState<string | null>(null);
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
      
      let finalPrompt = '';
      if (mode === 'prompt') {
        finalPrompt = `YÊU CẦU CẤU TRÚC ĐỀ:
- Số câu trắc nghiệm (MCQ): ${mcqCount}
- Số câu Đúng/Sai (TRUE_FALSE): ${tfCount}
- Số câu trả lời ngắn (SHORT): ${shortCount}
- Số câu tự luận (ESSAY): ${essayCount}

NỘI DUNG YÊU CẦU CHI TIẾT:
${prompt}`;
      } else {
        finalPrompt = prompt || 'Hãy tạo đề trắc nghiệm từ tệp tin này.';
      }

      const response = await generateQuiz(finalPrompt, fileData);
      
      if (response && response.includes('[ADJUSTMENT_NOTES]')) {
        const parts = response.split('[ADJUSTMENT_NOTES]');
        setResult(parts[0].trim());
        setAdjustmentNotes(parts[1].trim());
      } else {
        setResult(response || '');
        setAdjustmentNotes(null);
      }
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
      'Thang điểm',
      'Link ảnh lời giải',
      'Mức độ',
      'Chương/chủ đề',
      'Tên bài học',
      'Dạng toán',
      'Lớp'
    ];

    const data = tableLines.slice(2).map(line => {
      const trimmedLine = line.trim();
      
      // Remove leading and trailing pipes
      let cleanLine = trimmedLine;
      if (cleanLine.startsWith('|')) cleanLine = cleanLine.substring(1);
      if (cleanLine.endsWith('|')) cleanLine = cleanLine.substring(0, cleanLine.length - 1);
      
      // Split by pipe
      const rawCells = cleanLine.split('|').map(c => c.trim());
      
      const processedCells = Array(18).fill('');
      
      if (rawCells.length === 18) {
        rawCells.forEach((cell, i) => processedCells[i] = cell);
      } else if (rawCells.length > 18) {
        // Heuristic mapping: first 8 are columns 0-7, then last 9 from end, middle is explanation (8).
        for(let i=0; i<8; i++) processedCells[i] = rawCells[i] || '';
        
        processedCells[17] = rawCells[rawCells.length - 1] || '';
        processedCells[16] = rawCells[rawCells.length - 2] || '';
        processedCells[15] = rawCells[rawCells.length - 3] || '';
        processedCells[14] = rawCells[rawCells.length - 4] || '';
        processedCells[13] = rawCells[rawCells.length - 5] || '';
        processedCells[12] = rawCells[rawCells.length - 6] || '';
        processedCells[11] = rawCells[rawCells.length - 7] || '';
        processedCells[10] = rawCells[rawCells.length - 8] || '';
        processedCells[9] = rawCells[rawCells.length - 9] || '';
        
        processedCells[8] = rawCells.slice(8, rawCells.length - 9).join(' | ');
      } else {
        rawCells.forEach((cell, i) => { if (i < 18) processedCells[i] = cell; });
      }

      // Final sanitization for TSV
      const rowData = processedCells.map((cell, index) => {
        let sanitized = cell.replace(/\t/g, ' ');
        sanitized = sanitized.replace(/\r?\n/g, ' ');
        
        // If it's the answer column (index 6) and contains any separators common for TF, normalize to |
        if (index === 6 && (sanitized.includes(';') || sanitized.includes(',') || (sanitized.length >= 4 && !sanitized.includes('|')))) {
          // Attempt to normalize ĐS... or Đ;S... to Đ|S|...
          const tokens = sanitized.split(/[;,]/).map(t => t.trim().toUpperCase()).filter(Boolean);
          if (tokens.length === 4) return tokens.join('|');
          // If no separators but exactly 4 Đ/S chars like ĐSĐS
          const charTokens = sanitized.replace(/\s+/g, '').match(/[ĐS]/gi);
          if (charTokens && charTokens.length === 4) return charTokens.map(c => c.toUpperCase()).join('|');
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

  const parseTableData = () => {
    if (!result) return [];
    
    const lines = result.trim().split('\n');
    const tableLines = lines.filter(line => line.trim().startsWith('|'));
    
    if (tableLines.length < 3) return [];

    return tableLines.slice(2).map(line => {
      let cleanLine = line.trim();
      if (cleanLine.startsWith('|')) cleanLine = cleanLine.substring(1);
      if (cleanLine.endsWith('|')) cleanLine = cleanLine.substring(0, cleanLine.length - 1);
      
      const rawCells = cleanLine.split('|').map(c => c.trim());
      const processedCells = Array(18).fill('');
      
      if (rawCells.length === 18) {
        rawCells.forEach((cell, i) => processedCells[i] = cell);
      } else if (rawCells.length > 18) {
        for(let i=0; i<8; i++) processedCells[i] = rawCells[i] || '';
        processedCells[17] = rawCells[rawCells.length - 1] || '';
        processedCells[16] = rawCells[rawCells.length - 2] || '';
        processedCells[15] = rawCells[rawCells.length - 3] || '';
        processedCells[14] = rawCells[rawCells.length - 4] || '';
        processedCells[13] = rawCells[rawCells.length - 5] || '';
        processedCells[12] = rawCells[rawCells.length - 6] || '';
        processedCells[11] = rawCells[rawCells.length - 7] || '';
        processedCells[10] = rawCells[rawCells.length - 8] || '';
        processedCells[9] = rawCells[rawCells.length - 9] || '';
        processedCells[8] = rawCells.slice(8, rawCells.length - 9).join(' | ');
      } else {
        rawCells.forEach((cell, i) => { if (i < 18) processedCells[i] = cell; });
      }

      return {
        id: processedCells[0],
        content: processedCells[1],
        optionA: processedCells[2],
        optionB: processedCells[3],
        optionC: processedCells[4],
        optionD: processedCells[5],
        answer: processedCells[6],
        type: processedCells[7],
        explanation: processedCells[8],
        image: processedCells[9],
        timeLimit: processedCells[10],
        scoreScale: processedCells[11],
        explanationImage: processedCells[12],
        level: processedCells[13],
        topic: processedCells[14],
        lessonName: processedCells[15],
        questionType2: processedCells[16],
        gradeLevel: processedCells[17]
      };
    });
  };

  const handleExportWordLatex = async () => {
    const questions = parseTableData();
    if (questions.length === 0) return;

    const latexHeader = [
      "\\documentclass[12pt,a4paper]{article}",
      "\\usepackage[utf8]{vietnam}",
      "\\usepackage{amsmath,amssymb,amsfonts,amsthm}",
      "\\usepackage{geometry}",
      "\\usepackage{multicol}",
      "\\usepackage{enumerate}",
      "\\geometry{a4paper,left=1.5cm,right=1.5cm,top=2cm,bottom=2cm}",
      "",
      "% --- Khai báo môi trường câu hỏi (Tương thích GrindEQ/Oval) ---",
      "\\newenvironment{ex}{\\par\\medskip\\noindent}{\\medskip}",
      "\\newcommand{\\shortchoice}[4]{\\par\\noindent A. #1 \\hfill B. #2 \\hfill C. #3 \\hfill D. #4}",
      "\\newcommand{\\choiceTF}[4]{\\par\\noindent a) #1 \\hfill b) #2 \\hfill c) #3 \\hfill d) #4}",
      "% ------------------------------------------------",
      "",
      "\\begin{document}",
      "\\begin{center}",
      "    \\textbf{\\Large ĐỀ KIỂM TRA TRẮC NGHIỆM}",
      "\\end{center}",
      ""
    ];

    const questionSections = questions.map((q) => {
      // Helper to replace safe-latex back to standard for Word export
      // Uses \\\\ \n to ensure line breaks are respected in LaTeX
      const toStdLatex = (str: string) => str.replace(/<br>/g, ' \\\\ \n').replace(/\\vert/g, '|');

      const qLines: string[] = [];
      qLines.push(`% --- Câu ${q.id} ---`);
      // Hardcoding "Câu X." as text to ensure GrindEQ doesn't lose the number
      qLines.push(`\\begin{ex}\\textbf{Câu ${q.id}.} `);
      qLines.push(toStdLatex(q.content));
      
      if (q.type === 'MCQ') {
        const choices = `{${q.optionA}}{${q.optionB}}{${q.optionC}}{${q.optionD}}`.replace(/<br>/g, ' ');
        qLines.push(`\\shortchoice${toStdLatex(choices)}`);
      } else if (q.type === 'TRUE_FALSE') {
        const choices = `{${q.optionA}}{${q.optionB}}{${q.optionC}}{${q.optionD}}`.replace(/<br>/g, ' ');
        qLines.push(`\\choiceTF${toStdLatex(choices)}`);
      }

      // Flattening \loigiai for GrindEQ compatibility
      qLines.push(`\\par\\noindent\\textbf{Lời giải.} \\\\`);
      qLines.push(`Đáp án: ${q.answer}. \\\\`);
      qLines.push(toStdLatex(q.explanation));
      
      qLines.push(`\\end{ex}`);
      qLines.push("");
      return qLines;
    }).flat();

    const latexFooter = ["\\end{document}"];

    const allLines = [...latexHeader, ...questionSections, ...latexFooter];

    const doc = new Document({
      sections: [{
        properties: {},
        children: allLines.map(line => 
          new Paragraph({
            children: [
              new TextRun({ 
                text: line, 
                font: "Courier New", 
                size: 22,
                color: line.startsWith("\\") ? "2563EB" : "000000"
              })
            ],
            spacing: { after: 0 }
          })
        )
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "De_Thi_LaTeX_Full.docx");
  };

  const handleExportWord = async () => {
    const questions = parseTableData();
    if (questions.length === 0) return;

    const docChildren: any[] = [];

    // Title
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: "ĐỀ KIỂM TRA TRẮC NGHIỆM", bold: true, size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );

    questions.forEach((q) => {
      // Question text
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Câu ${q.id}. `, bold: true }),
            new TextRun({ text: q.content.replace(/<br>/g, '\n') }),
          ],
          spacing: { before: 200 },
        })
      );

      // Options
      if (q.type === 'MCQ' || q.type === 'TRUE_FALSE') {
        const optionPrefix = q.type === 'MCQ' ? ['A. ', 'B. ', 'C. ', 'D. '] : ['a) ', 'b) ', 'c) ', 'd) '];
        const options = [q.optionA, q.optionB, q.optionC, q.optionD];
        
        options.forEach((opt, idx) => {
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: optionPrefix[idx], bold: true }),
                new TextRun({ text: opt.replace(/<br>/g, ' ') }),
              ],
              indent: { left: 400 },
            })
          );
        });
      }

      // Answer & Explanation
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Đáp án: ", bold: true }),
            new TextRun({ text: q.answer }),
          ],
          indent: { left: 400 },
          spacing: { before: 100 },
        })
      );

      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Lời giải chi tiết: ", bold: true, italics: true }),
            new TextRun({ text: q.explanation.replace(/<br>/g, '\n') }),
          ],
          indent: { left: 400 },
          spacing: { after: 200 },
        })
      );
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "De_Thi_Word_Chuan.docx");
  };

  const handleDownloadImages = async () => {
    const data = parseTableData();
    const zip = new JSZip();
    let imageCount = 0;

    data.forEach((row: any) => {
      // Tìm mã SVG trong cột image.
      const svgMatch = row.image.match(/<svg[\s\S]*?<\/svg>/i);
      if (svgMatch) {
        imageCount++;
        const svgContent = svgMatch[0].replace(/<br\s*\/?>/gi, '\n');
        const filename = `cau${row.id || imageCount}_de.svg`;
        zip.file(filename, svgContent);
      }

      // Tìm mã SVG trong cột explanationImage.
      if (row.explanationImage) {
        const svgMatchExpl = row.explanationImage.match(/<svg[\s\S]*?<\/svg>/i);
        if (svgMatchExpl) {
          imageCount++;
          const svgContentExpl = svgMatchExpl[0].replace(/<br\s*\/?>/gi, '\n');
          const filenameExpl = `cau${row.id || imageCount}_loigiai.svg`;
          zip.file(filenameExpl, svgContentExpl);
        }
      }
    });

    if (imageCount === 0) {
      alert("Không tìm thấy hình ảnh minh họa nào để tải!");
      return;
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "Hinh_Anh_Minh_Hoa.zip");
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
                  Tạo đề bằng A.I
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
                  <div className="space-y-6">
                    {/* Q counts GRID */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-700">Số câu trắc nghiệm (4 phương án)</label>
                        <input
                          type="number"
                          min="0"
                          value={mcqCount}
                          onChange={(e) => setMcqCount(e.target.value)}
                          className="w-20 p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-center text-sm font-bold"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-700">Số câu đúng/sai</label>
                        <input
                          type="number"
                          min="0"
                          value={tfCount}
                          onChange={(e) => setTfCount(e.target.value)}
                          className="w-20 p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-center text-sm font-bold"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-700">Số câu trả lời ngắn (điền đáp số)</label>
                        <input
                          type="number"
                          min="0"
                          value={shortCount}
                          onChange={(e) => setShortCount(e.target.value)}
                          className="w-20 p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-center text-sm font-bold"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-700">Số câu tự luận</label>
                        <input
                          type="number"
                          min="0"
                          value={essayCount}
                          onChange={(e) => setEssayCount(e.target.value)}
                          className="w-20 p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-center text-sm font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        Mô tả yêu cầu cụ thể
                      </label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Nhập chủ đề, nội dung câu hỏi, mức độ, cấu trúc chi tiết... (Bạn có thể yêu cầu A.I vẽ thêm hình minh họa cho các câu hỏi nếu cần)"
                        className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none text-sm leading-relaxed"
                      />
                      <p className="text-[11px] text-slate-400 italic italic">Gợi ý: Cung cấp càng nhiều chi tiết về nội dung ôn tập, A.I sẽ tạo đề sát chương trình hơn.</p>
                    </div>
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
                  <span>Copy bảng Markdown hoặc Xuất file Word để lưu trữ đề thi.</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 bg-indigo-800 rounded-full flex items-center justify-center text-[10px] shrink-0">4</span>
                  <span><strong>Mới:</strong> Yêu cầu A.I "vẽ hình minh họa" để tạo hình ảnh, sau đó dùng nút <strong>"Tải hình"</strong> để tải file .zip về máy.</span>
                </li>
              </ul>
            </section>
          </div>

          {/* Right Panel: Result */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
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
                    onClick={handleExportWord}
                    disabled={!result}
                    className={cn(
                      "p-2 rounded-lg transition-all flex items-center gap-1 text-sm font-medium",
                      result ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "text-slate-300 cursor-not-allowed"
                    )}
                  >
                    <FileDoc className="w-4 h-4" />
                    Word
                  </button>
                  <button
                    onClick={handleExportWordLatex}
                    disabled={!result}
                    className={cn(
                      "p-2 rounded-lg transition-all flex items-center gap-1 text-sm font-medium",
                      result ? "bg-cyan-50 text-cyan-600 hover:bg-cyan-100" : "text-slate-300 cursor-not-allowed"
                    )}
                  >
                    <FileDoc className="w-4 h-4" />
                    WordLatex
                  </button>
                  <button
                    onClick={handleDownloadImages}
                    disabled={!result}
                    className={cn(
                      "p-2 rounded-lg transition-all flex items-center gap-1 text-sm font-medium",
                      result ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "text-slate-300 cursor-not-allowed"
                    )}
                  >
                    <ImageIcon className="w-4 h-4" />
                    Tải hình
                  </button>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-auto custom-scrollbar relative">
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
                      <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-2 text-indigo-800 text-xs">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>
                          <strong>Lưu ý:</strong> Để đảm bảo tính chính xác cho các công thức, đáp án Đúng/Sai được hiển thị tạm thời bằng dấu ";" trong bảng dưới đây. 
                          Khi bạn nhấn <strong>"Copy cho Sheets"</strong> hoặc xuất file, hệ thống sẽ tự động định dạng lại theo đúng quy chuẩn.
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

            {/* Adjustment Notes Section */}
            {mode === 'file' && result && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
              >
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  👉 Ghi chú điều chỉnh so với đề gốc
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm text-slate-700 leading-relaxed min-h-[100px]">
                  {adjustmentNotes ? (
                    <ReactMarkdown>{adjustmentNotes}</ReactMarkdown>
                  ) : (
                    <p className="italic text-slate-400">Không có chỉnh sửa nào được thực hiện.</p>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-8 border-t border-slate-200 mt-12 text-center">
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
        
        .markdown-body svg {
          max-width: 100%;
          height: auto;
          background: white;
          border-radius: 4px;
          padding: 4px;
          display: block;
          margin: 0 auto;
        }
      `}} />
    </div>
  );
}

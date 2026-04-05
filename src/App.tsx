import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Image as ImageIcon, 
  History, 
  Printer, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Download,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { geminiService } from './services/gemini';
import { Question, Analogy, AppTab } from './types';
import { cn } from './lib/utils';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('recognition');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Recognition state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [recognitionResult, setRecognitionResult] = useState<any>(null);
  const [analogies, setAnalogies] = useState<Analogy[]>([]);
  const [isGeneratingAnalogies, setIsGeneratingAnalogies] = useState(false);

  // Bank state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('wrong_questions');
    if (saved) {
      try {
        setQuestions(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load questions', e);
      }
    }
  }, []);

  const saveQuestions = (newQuestions: Question[]) => {
    setQuestions(newQuestions);
    localStorage.setItem('wrong_questions', JSON.stringify(newQuestions));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setSelectedImage(base64);
      processImage(base64.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string) => {
    setLoading(true);
    setError(null);
    setRecognitionResult(null);
    setAnalogies([]);
    
    try {
      const result = await geminiService.recognizeAndAnalyze(base64);
      setRecognitionResult(result);
    } catch (err) {
      setError('识别失败，请重试');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateAnalogies = async () => {
    if (!recognitionResult) return;
    setIsGeneratingAnalogies(true);
    try {
      const result = await geminiService.generateAnalogies(
        recognitionResult.text,
        recognitionResult.knowledgePoint
      );
      setAnalogies(result.map((a: any, i: number) => ({ ...a, id: Date.now().toString() + i })));
    } catch (err) {
      setError('生成举一反三失败，请重试');
    } finally {
      setIsGeneratingAnalogies(false);
    }
  };

  const saveToBank = () => {
    if (!recognitionResult || analogies.length === 0) return;
    
    const newQuestion: Question = {
      id: Date.now().toString(),
      originalText: recognitionResult.text,
      originalImage: selectedImage || undefined,
      knowledgePoint: recognitionResult.knowledgePoint,
      options: recognitionResult.options,
      userAnswer: recognitionResult.userAnswer,
      correctAnswer: recognitionResult.correctAnswer,
      analogies: analogies,
      createdAt: Date.now(),
    };

    saveQuestions([newQuestion, ...questions]);
    setActiveTab('bank');
    // Reset recognition state
    setSelectedImage(null);
    setRecognitionResult(null);
    setAnalogies([]);
  };

  const deleteQuestion = (id: string) => {
    saveQuestions(questions.filter(q => q.id !== id));
    const newSelected = new Set(selectedIds);
    newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const printSelected = async () => {
    if (selectedIds.size === 0) return;
    
    const printArea = document.createElement('div');
    printArea.style.position = 'absolute';
    printArea.style.left = '-9999px';
    printArea.style.width = '800px';
    printArea.style.padding = '40px';
    printArea.style.backgroundColor = 'white';
    printArea.className = 'print-container';
    
    const selectedQuestions = questions.filter(q => selectedIds.has(q.id));
    
    selectedQuestions.forEach((q, idx) => {
      const qDiv = document.createElement('div');
      qDiv.style.marginBottom = '40px';
      qDiv.style.borderBottom = '1px solid #eee';
      qDiv.style.paddingBottom = '20px';
      
      qDiv.innerHTML = `
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">错题 ${idx + 1} [${q.knowledgePoint}]</h2>
        <div style="margin-bottom: 15px; line-height: 1.6;">${q.originalText}</div>
        ${q.options ? `<div style="margin-bottom: 10px;">${q.options.join(' ')}</div>` : ''}
        <div style="margin-top: 10px; padding: 10px; background: #f9f9f9; border-radius: 4px;">
          <p><strong>正确答案:</strong> ${q.correctAnswer || '未提供'}</p>
        </div>
        <h3 style="font-size: 16px; font-weight: bold; margin-top: 20px; color: #2563eb;">举一反三练习</h3>
      `;
      
      q.analogies.forEach((a, aidx) => {
        const aDiv = document.createElement('div');
        aDiv.style.marginTop = '15px';
        aDiv.style.padding = '15px';
        aDiv.style.border = '1px dashed #ccc';
        aDiv.style.borderRadius = '8px';
        aDiv.innerHTML = `
          <p><strong>变式题 ${aidx + 1}:</strong></p>
          <div style="margin: 10px 0;">${a.text}</div>
          <div style="margin-top: 10px; font-size: 14px; color: #666;">
            <p><strong>答案:</strong> ${a.answer}</p>
            <p><strong>解析:</strong> ${a.analysis}</p>
          </div>
        `;
        qDiv.appendChild(aDiv);
      });
      
      printArea.appendChild(qDiv);
    });

    document.body.appendChild(printArea);
    
    try {
      const canvas = await html2canvas(printArea, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`错题集_${new Date().toLocaleDateString()}.pdf`);
    } catch (err) {
      console.error('PDF generation failed', err);
    } finally {
      document.body.removeChild(printArea);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Printer className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">错题举一反三打印机</h1>
        </div>
        {activeTab === 'bank' && selectedIds.size > 0 && (
          <button 
            onClick={printSelected}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 transition-all active:scale-95 shadow-sm"
          >
            <Download className="w-4 h-4" />
            生成 PDF ({selectedIds.size})
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'recognition' ? (
            <motion.div 
              key="recognition"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 max-w-2xl mx-auto space-y-6"
            >
              {/* Upload Section */}
              <section className="space-y-4">
                {!selectedImage ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center justify-center bg-white hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="bg-blue-100 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                      <Camera className="w-8 h-8 text-blue-600" />
                    </div>
                    <p className="font-medium text-slate-600">点击或拖拽上传错题图片</p>
                    <p className="text-sm text-slate-400 mt-1">支持 JPG, PNG, WEBP</p>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden shadow-md bg-white border border-slate-200">
                    <img src={selectedImage} alt="Selected" className="w-full h-auto max-h-80 object-contain bg-slate-100" />
                    <button 
                      onClick={() => { setSelectedImage(null); setRecognitionResult(null); setAnalogies([]); }}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </section>

              {/* Loading State */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                  <p className="text-slate-500 animate-pulse">正在识别题目并提取知识点...</p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">识别出错</p>
                    <p className="text-sm opacity-90">{error}</p>
                    <button 
                      onClick={() => selectedImage && processImage(selectedImage.split(',')[1])}
                      className="mt-2 text-sm font-bold underline"
                    >
                      重试
                    </button>
                  </div>
                </div>
              )}

              {/* Recognition Result */}
              {recognitionResult && !loading && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                >
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <h2 className="font-bold">识别结果</h2>
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                      {recognitionResult.knowledgePoint}
                    </span>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">题目内容</label>
                      <textarea 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        rows={4}
                        value={recognitionResult.text}
                        onChange={(e) => setRecognitionResult({...recognitionResult, text: e.target.value})}
                      />
                    </div>
                    
                    {recognitionResult.options && recognitionResult.options.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">选项</label>
                        <div className="grid grid-cols-1 gap-2">
                          {recognitionResult.options.map((opt: string, i: number) => (
                            <div key={i} className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-sm">
                              {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">你的答案</label>
                        <p className="text-sm font-medium text-slate-600">{recognitionResult.userAnswer || '未识别'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">标准答案</label>
                        <p className="text-sm font-bold text-green-600">{recognitionResult.correctAnswer || '未识别'}</p>
                      </div>
                    </div>

                    <button 
                      onClick={generateAnalogies}
                      disabled={isGeneratingAnalogies}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      {isGeneratingAnalogies ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          正在生成变式题...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-5 h-5" />
                          {analogies.length > 0 ? '重新生成举一反三' : '生成举一反三'}
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Analogies List */}
              {analogies.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-500 px-1">举一反三变式题</h3>
                  {analogies.map((a, i) => (
                    <motion.div 
                      key={a.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3"
                    >
                      <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="font-bold text-sm">变式题</span>
                      </div>
                      <div className="text-slate-700 leading-relaxed">
                        <Markdown>{a.text}</Markdown>
                      </div>
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <p className="text-sm font-bold text-green-600">答案: {a.answer}</p>
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                          <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            易错点解析
                          </p>
                          <div className="text-sm text-amber-900 opacity-90">
                            <Markdown>{a.analysis}</Markdown>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  <button 
                    onClick={saveToBank}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    保存到错题本
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="bank"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 max-w-4xl mx-auto space-y-4"
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="font-bold text-slate-500">历史错题 ({questions.length})</h2>
                {questions.length > 0 && (
                  <button 
                    onClick={() => {
                      if (selectedIds.size === questions.length) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(questions.map(q => q.id)));
                      }
                    }}
                    className="text-sm font-bold text-blue-600 hover:underline"
                  >
                    {selectedIds.size === questions.length ? '取消全选' : '全选'}
                  </button>
                )}
              </div>

              {questions.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <History className="w-16 h-16 opacity-20" />
                  <p>暂无错题记录，快去识别第一道题吧</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {questions.map((q) => (
                    <div 
                      key={q.id}
                      className={cn(
                        "bg-white rounded-2xl border transition-all relative group",
                        selectedIds.has(q.id) ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div className="p-4 flex gap-4">
                        <div 
                          onClick={(e) => { e.stopPropagation(); toggleSelect(q.id); }}
                          className="shrink-0 cursor-pointer"
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                            selectedIds.has(q.id) ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white"
                          )}>
                            {selectedIds.has(q.id) && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </div>
                        </div>
                        
                        <div 
                          className="flex-1 min-w-0 space-y-2 cursor-pointer"
                          onClick={() => setSelectedQuestion(q)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                              {q.knowledgePoint}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(q.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-relaxed">
                            {q.originalText}
                          </p>
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex -space-x-2">
                              {q.analogies.map((_, i) => (
                                <div key={i} className="w-6 h-6 rounded-full bg-blue-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-blue-600">
                                  {i + 1}
                                </div>
                              ))}
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }}
                              className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-around z-20 pb-safe">
        <button 
          onClick={() => setActiveTab('recognition')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'recognition' ? "text-blue-600" : "text-slate-400"
          )}
        >
          <div className={cn(
            "p-2 rounded-xl transition-all",
            activeTab === 'recognition' ? "bg-blue-50" : ""
          )}>
            <Camera className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold">错题识别</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('bank')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'bank' ? "text-blue-600" : "text-slate-400"
          )}
        >
          <div className={cn(
            "p-2 rounded-xl transition-all",
            activeTab === 'bank' ? "bg-blue-50" : ""
          )}>
            <History className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold">错题本</span>
        </button>
      </nav>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedQuestion && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedQuestion(null)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-2xl h-[90vh] sm:h-auto sm:max-h-[80vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="font-bold">错题详情</h3>
                <button onClick={() => setSelectedQuestion(null)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Original Question */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-blue-600 rounded-full" />
                    <h4 className="font-bold text-slate-900">原错题</h4>
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                      {selectedQuestion.knowledgePoint}
                    </span>
                  </div>
                  {selectedQuestion.originalImage && (
                    <img src={selectedQuestion.originalImage} alt="Original" className="w-full rounded-xl border border-slate-100" />
                  )}
                  <div className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <Markdown>{selectedQuestion.originalText}</Markdown>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                      <p className="text-[10px] font-bold text-red-400 uppercase mb-1">你的答案</p>
                      <p className="text-sm font-bold text-red-700">{selectedQuestion.userAnswer || '无'}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                      <p className="text-[10px] font-bold text-green-400 uppercase mb-1">标准答案</p>
                      <p className="text-sm font-bold text-green-700">{selectedQuestion.correctAnswer || '无'}</p>
                    </div>
                  </div>
                </section>

                {/* Analogies */}
                <section className="space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-amber-500 rounded-full" />
                    <h4 className="font-bold text-slate-900">举一反三练习</h4>
                  </div>
                  <div className="space-y-6">
                    {selectedQuestion.analogies.map((a, i) => (
                      <div key={i} className="space-y-3">
                        <div className="flex items-center gap-2 text-blue-600">
                          <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 rounded">变式题 {i + 1}</span>
                        </div>
                        <div className="text-slate-700 leading-relaxed">
                          <Markdown>{a.text}</Markdown>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                          <p className="text-sm font-bold text-green-600">答案: {a.answer}</p>
                          <div className="text-sm text-slate-500 bg-white p-3 rounded-lg border border-slate-100 italic">
                            <Markdown>{a.analysis}</Markdown>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

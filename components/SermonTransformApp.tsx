'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Heart, 
  Share2, 
  Users, 
  Upload, 
  FileText, 
  Sparkles, 
  Copy, 
  Check, 
  Loader2,
  Mic,
  Music
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ContentType = 'summary' | 'study' | 'devotional' | 'social' | 'groups';

interface GeneratedContent {
  summary: string;
  study: string;
  devotional: string;
  social: string;
  groups: string;
}

export default function SermonTransformApp() {
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<ContentType>('summary');
  const [results, setResults] = useState<GeneratedContent | null>(null);
  const [copied, setCopied] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit for inlineData

  const handleCopy = async () => {
    if (!results) return;
    const content = results[activeTab];
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`O arquivo é muito grande (${(file.size / (1024 * 1024)).toFixed(1)}MB). O limite para upload direto é de 20MB. Por favor, use um arquivo menor ou cole o texto da pregação.`);
        setAudioFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setError(null);
      setAudioFile(file);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const generateContent = async () => {
    if (!inputText && !audioFile) return;
    
    setIsGenerating(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY! });
      
      let promptParts: any[] = [];
      
      if (audioFile) {
        // Double check size just in case
        if (audioFile.size > MAX_FILE_SIZE) {
          throw new Error("Arquivo acima do limite de 20MB.");
        }
        const base64Audio = await fileToBase64(audioFile);
        promptParts.push({
          inlineData: {
            data: base64Audio,
            mimeType: audioFile.type
          }
        });
        promptParts.push({ text: "Analise este áudio de pregação e gere o conteúdo solicitado abaixo. Identifique os pontos principais, o texto bíblico citado e a mensagem central." });
      } else {
        promptParts.push({ text: `Aqui está o texto da pregação:\n\n${inputText}` });
      }

      promptParts.push({ text: `
        Com base na pregação fornecida, gere 5 tipos de conteúdo estruturados em Markdown.
        Retorne um objeto JSON onde cada valor é uma STRING formatada em Markdown:
        - summary: Uma string Markdown contendo um resumo executivo da pregação (máximo 300 palavras), destacando a tese central e os principais ensinamentos.
        - study: Uma string Markdown contendo um estudo bíblico estruturado com Texto Base, Pontos Principais (com explicações) e Aplicação Prática.
        - devotional: Uma string Markdown contendo uma reflexão curta para cada dia da semana (7 dias), cada um com um versículo chave e uma oração curta.
        - social: Uma string Markdown contendo 3 opções de legendas para Instagram, 5 frases impactantes (quotes) e uma lista de hashtags relevantes.
        - groups: Uma string Markdown contendo um guia de discussão para pequenos grupos com Quebra-gelo, Perguntas para partilha e Motivos de oração.

        IMPORTANTE: Os valores devem ser strings Markdown puras, não objetos ou arrays.
        Use um tom espiritual, encorajador e fiel ao conteúdo original.
      ` });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: promptParts }],
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (text) {
        // Robust JSON extraction
        const extractJson = (str: string) => {
          const start = str.indexOf('{');
          if (start === -1) return null;
          
          let depth = 0;
          let inString = false;
          let escaped = false;
          
          for (let i = start; i < str.length; i++) {
            const char = str[i];
            if (escaped) { escaped = false; continue; }
            if (char === '\\') { escaped = true; continue; }
            if (char === '"') { inString = !inString; continue; }
            
            if (!inString) {
              if (char === '{') depth++;
              else if (char === '}') {
                depth--;
                if (depth === 0) return str.substring(start, i + 1);
              }
            }
          }
          return null;
        };

        const jsonStr = extractJson(text);
        
        try {
          if (!jsonStr) throw new Error("Não foi possível encontrar um objeto JSON válido.");
          const parsed = JSON.parse(jsonStr);
          setResults(parsed);
        } catch (parseError) {
          console.error("Erro ao parsear JSON:", parseError, "Texto original:", text);
          throw new Error("A resposta da IA não veio no formato esperado. Por favor, tente novamente.");
        }
      }
    } catch (err: any) {
      console.error("Erro ao gerar conteúdo:", err);
      setError(err.message || "Ocorreu um erro ao processar sua solicitação. Verifique o tamanho do arquivo ou tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const tabs = [
    { id: 'summary', label: 'Resumo', icon: FileText },
    { id: 'study', label: 'Estudo Bíblico', icon: BookOpen },
    { id: 'devotional', label: 'Devocional', icon: Heart },
    { id: 'social', label: 'Redes Sociais', icon: Share2 },
    { id: 'groups', label: 'Pequenos Grupos', icon: Users },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="w-full text-center mb-12">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-4"
        >
          <Sparkles size={16} />
          <span>Inteligência Artificial a Serviço do Reino</span>
        </motion.div>
        <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight text-white mb-4">
          Sermon<span className="text-cyan-400">Transform</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto font-sans">
          Transforme suas pregações em materiais edificantes para sua igreja e comunidade em segundos.
        </p>
      </header>

      <main className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Section */}
        <section className="lg:col-span-5 space-y-6">
          <div className="glass rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-semibold flex items-center gap-2">
                <FileText className="text-cyan-400" size={20} />
                Entrada da Pregação
              </h2>
              {audioFile && (
                <span className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-md flex items-center gap-1">
                  <Music size={12} /> {audioFile.name.length > 15 ? audioFile.name.substring(0, 15) + '...' : audioFile.name}
                </span>
              )}
            </div>

            <div className="space-y-4">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
                >
                  {error}
                </motion.div>
              )}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Cole aqui o esboço ou a transcrição da pregação..."
                className="w-full h-64 bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none font-sans"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl glass glass-hover text-slate-300 font-medium text-sm"
                >
                  <Upload size={18} />
                  {audioFile ? 'Trocar Áudio' : 'Upload de Áudio'}
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="audio/*" 
                  className="hidden" 
                />
              </div>

              <button
                onClick={generateContent}
                disabled={isGenerating || (!inputText && !audioFile)}
                className={cn(
                  "w-full py-4 rounded-2xl font-display font-bold text-lg flex items-center justify-center gap-3 transition-all",
                  isGenerating 
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                    : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 glow-cyan active:scale-[0.98]"
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    Processando...
                  </>
                ) : (
                  <>
                    <Sparkles size={24} />
                    Gerar Conteúdo
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-white/5 bg-white/5">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Dicas de uso</h3>
            <ul className="space-y-3 text-sm text-slate-500">
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                Para melhores resultados, forneça o esboço completo ou a transcrição fiel.
              </li>
              <li className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                O upload de áudio permite que a IA extraia o tom e a emoção da mensagem.
              </li>
            </ul>
          </div>
        </section>

        {/* Output Section */}
        <section className="lg:col-span-7">
          <div className="glass rounded-3xl overflow-hidden flex flex-col h-full min-h-[600px]">
            {/* Tabs */}
            <div className="flex border-b border-white/5 bg-slate-900/40 p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ContentType)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all relative",
                    activeTab === tab.id ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  <tab.icon size={20} />
                  <span className="text-[10px] md:text-xs font-medium uppercase tracking-wider">{tab.label}</span>
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-cyan-400 rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto relative">
              <AnimatePresence mode="wait">
                {!results ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20"
                  >
                    <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center border border-white/5">
                      <Sparkles className="text-slate-700" size={40} />
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">Aguardando sua pregação...</p>
                      <p className="text-slate-600 text-sm">O conteúdo gerado aparecerá aqui.</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="prose prose-invert max-w-none"
                  >
                    <div className="flex justify-end mb-6 sticky top-0 z-10">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 py-2 px-4 rounded-xl bg-slate-800/80 backdrop-blur border border-white/10 text-slate-300 hover:text-white transition-all text-sm font-medium"
                      >
                        {copied ? (
                          <>
                            <Check size={16} className="text-green-400" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy size={16} />
                            Copiar Tudo
                          </>
                        )}
                      </button>
                    </div>
                    <ReactMarkdown>
                      {typeof results[activeTab] === 'string' 
                        ? results[activeTab] 
                        : JSON.stringify(results[activeTab], null, 2)}
                    </ReactMarkdown>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-white/5 w-full text-center text-slate-600 text-sm">
        <p>&copy; 2026 SermonTransform AI. Tecnologia para a glória de Deus.</p>
      </footer>
    </div>
  );
}

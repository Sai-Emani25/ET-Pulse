/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Briefcase, 
  GraduationCap, 
  Rocket, 
  Globe, 
  ChevronRight, 
  ArrowLeft, 
  Search, 
  Clock, 
  Share2, 
  Bookmark,
  MessageSquare,
  Zap,
  BarChart3,
  Layers,
  Sparkles,
  Video,
  Play,
  Pause,
  Download,
  AlertCircle,
  X,
  Loader2,
  Presentation,
  Copy,
  Check
} from 'lucide-react';
import { cn } from './lib/utils';
import { Persona, NewsStory, Briefing } from './types';
import { getPersonalizedFeed, getStoryBriefing, askFollowUp, generateNarration, startVideoGeneration, pollVideoStatus, fetchVideoBlob, generatePPTPrompt } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import { VideoPlayer } from './components/VideoPlayer';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const PERSONAS = [
  { id: 'investor', label: 'Mutual Fund Investor', icon: TrendingUp, desc: 'Focus on market trends, portfolio impact, and long-term growth.' },
  { id: 'founder', label: 'Startup Founder', icon: Rocket, desc: 'Funding news, competitor moves, and ecosystem shifts.' },
  { id: 'student', label: 'Student / Aspirant', icon: GraduationCap, desc: 'Explainer-first content, career insights, and fundamental business concepts.' },
  { id: 'executive', label: 'Corporate Executive', icon: Briefcase, desc: 'Strategic analysis, policy changes, and industry leadership.' },
  { id: 'general', label: 'General Reader', icon: Globe, desc: 'Top headlines, broad economic impact, and daily essentials.' },
] as const;

export default function App() {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [language, setLanguage] = useState<'EN' | 'HI'>('EN');
  const [feed, setFeed] = useState<NewsStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStory, setSelectedStory] = useState<NewsStory | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [question, setQuestion] = useState('');

  // Video Studio State
  const [showVideoStudio, setShowVideoStudio] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  // PPT State
  const [pptOutline, setPptOutline] = useState<string | null>(null);
  const [pptLoading, setPptLoading] = useState(false);
  const [showPptModal, setShowPptModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    if (persona) {
      loadFeed();
    }
  }, [persona]);

  const loadFeed = async () => {
    if (!persona) return;
    setLoading(true);
    const data = await getPersonalizedFeed(persona);
    setFeed(data);
    setLoading(false);
  };

  const handleStorySelect = async (story: NewsStory) => {
    setSelectedStory(story);
    setBriefingLoading(true);
    setBriefing(null);
    setChat([]);
    const data = await getStoryBriefing(story.title, persona!);
    setBriefing(data);
    setBriefingLoading(false);
    setPptOutline(null);
  };

  const handleGeneratePPT = async () => {
    if (!briefing || !persona) return;
    setPptLoading(true);
    setShowPptModal(true);
    const outline = await generatePPTPrompt(briefing, persona);
    setPptOutline(outline);
    setPptLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAsk = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!question.trim() || !selectedStory || !briefing) return;
    
    const q = question;
    setQuestion('');
    setChat(prev => [...prev, { q, a: 'Thinking...' }]);
    
    const context = `Story: ${selectedStory.title}\nBriefing: ${briefing.overview}`;
    const answer = await askFollowUp(q, context);
    
    setChat(prev => {
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { q: last.q, a: answer }];
    });
  };

  const handleGenerateVideo = async () => {
    if (!selectedStory || !briefing) return;

    if (!hasApiKey) {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      } else {
        alert("API Key selection is only available in the AI Studio environment.");
      }
      return;
    }

    setShowVideoStudio(true);
    setVideoLoading(true);
    setVideoUrl(null);
    setAudioUrl(null);
    setVideoStatus('Generating narration script...');

    try {
      // 1. Generate Narration
      const narrationText = briefing.overview;
      const audio = await generateNarration(narrationText);
      setAudioUrl(audio);

      // 2. Start Video Generation
      setVideoStatus('Initializing broadcast visuals (Veo)...');
      let operation = await startVideoGeneration(selectedStory.title);

      // 3. Poll for completion
      setVideoStatus('Rendering cinematic news overlays...');
      const loadingMessages = [
        'Animating data visuals...',
        'Applying broadcast-quality lighting...',
        'Synthesizing contextual overlays...',
        'Finalizing video production...'
      ];
      let msgIdx = 0;

      while (!operation.done) {
        setVideoStatus(loadingMessages[msgIdx % loadingMessages.length]);
        msgIdx++;
        await new Promise(resolve => setTimeout(resolve, 8000));
        operation = await pollVideoStatus(operation);
      }

      const downloadUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadUri) {
        setVideoStatus('Fetching final render...');
        const blob = await fetchVideoBlob(downloadUri);
        setVideoUrl(URL.createObjectURL(blob));
      }
    } catch (error) {
      console.error('Video generation failed:', error);
      setVideoStatus('Generation failed. Please check your API key and try again.');
    } finally {
      setVideoLoading(false);
    }
  };

  if (!persona) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#0A0E1A] relative overflow-hidden">
        <div className="atmosphere" />
        <div className="fixed inset-0 dot-grid opacity-10 pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
          className="max-w-7xl w-full relative z-10"
        >
          <div className="mb-24 text-center space-y-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="inline-block px-8 py-3 rounded-full border border-accent/30 bg-accent/5 text-accent text-[12px] uppercase tracking-[0.6em] font-mono mb-8 backdrop-blur-md shimmer royal-border"
            >
              The Sovereign Newsroom
            </motion.div>
            <h1 className="text-[10rem] font-serif italic tracking-tight-display text-gradient leading-none drop-shadow-2xl mb-4">ET Pulse</h1>
            <p className="text-muted text-lg font-light tracking-[0.2em] uppercase opacity-70 max-w-2xl mx-auto">Curated Intelligence for the Elite Strategic Mind</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {PERSONAS.map((p, idx) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + idx * 0.1, duration: 0.8 }}
                onClick={() => setPersona(p.id as Persona)}
                className="group relative h-[550px] p-10 text-left border border-line hover:border-accent/60 transition-all duration-1000 bg-white/[0.03] backdrop-blur-xl overflow-hidden flex flex-col justify-between hover:bg-white/[0.08] royal-border shimmer glow-hover"
              >
                <div className="relative z-10">
                  <p className="text-accent font-mono text-[11px] mb-12 opacity-50 group-hover:opacity-100 transition-opacity font-bold tracking-[0.3em]">CHAMBER 0{idx + 1}</p>
                  <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-10 border border-accent/20 group-hover:bg-accent group-hover:text-black transition-all duration-500 shadow-xl group-hover:scale-110 group-hover:rotate-6">
                    <p.icon className="w-8 h-8 transition-transform duration-500" />
                  </div>
                  <h3 className="text-4xl font-serif italic leading-tight mb-8 group-hover:gold-text transition-all tracking-tight">{p.label}</h3>
                </div>
                
                <div className="relative z-10">
                  <p className="text-muted text-base leading-relaxed opacity-0 group-hover:opacity-100 transition-all duration-700 translate-y-6 group-hover:translate-y-0 font-light italic">
                    {p.desc}
                  </p>
                  <div className="mt-10 flex items-center gap-4 text-accent opacity-0 group-hover:opacity-100 transition-all duration-700 delay-200">
                    <span className="text-[11px] font-mono uppercase tracking-[0.4em] font-bold">Enter Domain</span>
                    <ChevronRight className="w-5 h-5 animate-pulse" />
                  </div>
                </div>

                {/* Decorative background element */}
                <div className="absolute -bottom-20 -right-20 opacity-[0.02] group-hover:opacity-[0.1] transition-all duration-1000 rotate-12 group-hover:rotate-0 group-hover:scale-125">
                  <p.icon className="w-80 h-80" />
                </div>
              </motion.button>
            ))}
          </div>

          <div className="mt-24 text-center">
            <p className="text-[11px] font-mono text-muted uppercase tracking-[0.5em] opacity-40">Select your domain to initiate the royal intelligence briefing</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-accent/30 relative">
      {/* Background Effects */}
      <div className="atmosphere" />
      <div className="fixed inset-0 dot-grid opacity-20 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-line bg-[#0A0E1A]/80 backdrop-blur-3xl px-10 py-6 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-20">
          <button 
            onClick={() => setPersona(null)} 
            className="text-4xl font-serif italic text-gradient hover:tracking-widest transition-all duration-1000 relative group"
          >
            ET Pulse
            <span className="absolute -bottom-2 left-0 w-0 h-0.5 bg-accent group-hover:w-full transition-all duration-700" />
          </button>
          <nav className="hidden lg:flex items-center gap-12 text-[11px] uppercase tracking-[0.4em] font-bold text-muted">
            <a href="#" className="text-accent relative group">
              The Feed
              <span className="absolute -bottom-2 left-0 w-full h-0.5 bg-accent shadow-[0_0_10px_var(--accent)]" />
            </a>
            <a href="#" className="hover:text-white transition-colors group relative">
              Market Intelligence
              <span className="absolute -bottom-2 left-0 w-0 h-0.5 bg-accent group-hover:w-full transition-all duration-700" />
            </a>
            <a href="#" className="hover:text-white transition-colors group relative">
              Policy Archives
              <span className="absolute -bottom-2 left-0 w-0 h-0.5 bg-accent group-hover:w-full transition-all duration-700" />
            </a>
            <a href="#" className="hover:text-white transition-colors group relative">
              Innovation Lab
              <span className="absolute -bottom-2 left-0 w-0 h-0.5 bg-accent group-hover:w-full transition-all duration-700" />
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-10">
          <div className="hidden sm:flex items-center gap-5 px-6 py-3 rounded-full border border-accent/20 bg-accent/5 backdrop-blur-2xl group hover:border-accent/50 transition-all shadow-lg relative">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-accent animate-ping opacity-30" />
            </div>
            <select 
              value={persona || ''} 
              onChange={(e) => setPersona(e.target.value as Persona)}
              className="bg-transparent text-[11px] uppercase tracking-[0.3em] font-mono text-accent font-bold focus:outline-none cursor-pointer appearance-none pr-4"
            >
              {PERSONAS.map(p => <option key={p.id} value={p.id} className="bg-[#0A0E1A] text-white">{p.label}</option>)}
            </select>
            <ChevronRight className="w-3 h-3 text-accent absolute right-4 rotate-90 pointer-events-none" />
          </div>
          <div 
            onClick={() => setLanguage(l => l === 'EN' ? 'HI' : 'EN')}
            className="flex items-center gap-3 px-4 py-2 rounded-xl border border-line bg-white/5 hover:bg-white/10 transition-all cursor-pointer group/toggle active:scale-95"
          >
            <span className={cn("text-[9px] font-mono uppercase tracking-widest font-bold transition-colors", language === 'EN' ? "text-accent" : "text-muted")}>EN</span>
            <div className="w-8 h-4 bg-accent/20 rounded-full relative">
              <div className={cn(
                "absolute top-1 w-2 h-2 bg-accent rounded-full transition-all duration-500",
                language === 'HI' ? "translate-x-4" : "translate-x-0"
              )} />
            </div>
            <span className={cn("text-[9px] font-mono uppercase tracking-widest font-bold transition-colors", language === 'HI' ? "text-accent" : "text-muted")}>HI</span>
          </div>
          <button className="p-3.5 hover:bg-accent/10 rounded-full transition-all hover:scale-110 border border-transparent hover:border-accent/20">
            <Search className="w-6 h-6 text-accent" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
            <div className="relative">
              <div className="w-16 h-16 border-2 border-accent/20 rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-muted font-mono text-[10px] uppercase tracking-[0.3em] animate-pulse">Synthesizing personalized intelligence...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            {/* Left Column: Feed */}
            <div className="lg:col-span-7 space-y-20">
              <div className="flex items-end justify-between border-b border-line pb-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-accent font-mono text-[10px] uppercase tracking-[0.4em] mb-4">
                    <span className="w-8 h-px bg-accent/30" />
                    Live Intelligence
                  </div>
                  <h2 className="text-7xl font-serif italic text-gradient tracking-tight-display">The Briefing</h2>
                  <p className="text-muted text-xs font-mono uppercase tracking-[0.3em] opacity-60">Global Strategic Report / 2026.03</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-accent font-mono text-[10px] uppercase tracking-[0.3em] mb-2 font-bold">Vol. 04 / Issue 12</p>
                  <p className="text-muted font-mono text-[10px] uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="space-y-16">
                {feed.map((story, idx) => (
                  <motion.div
                    key={story.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8, delay: idx * 0.1 }}
                    onClick={() => handleStorySelect(story)}
                    className="group cursor-pointer grid grid-cols-1 md:grid-cols-12 gap-10 pb-16 border-b border-line/30 hover:border-accent/40 transition-all duration-700"
                  >
                    <div className="md:col-span-3 space-y-6">
                      <div className={cn(
                        "category-tag",
                        story.category === "Markets" ? "tag-emerald" : 
                        story.category === "Policy" ? "tag-blue" : 
                        story.category === "Tech" ? "tag-purple" : "tag-gold"
                      )}>
                        {story.category}
                      </div>
                      <div className="flex items-center gap-3 text-muted text-[11px] font-mono uppercase tracking-widest opacity-70">
                        <Clock className="w-4 h-4 text-accent" />
                        {story.timestamp}
                      </div>
                    </div>
                    <div className="md:col-span-9 space-y-6">
                      <h3 className="text-4xl font-serif group-hover:text-accent transition-all duration-700 leading-[1.05] tracking-tight-display text-white/90">
                        {story.title}
                      </h3>
                      <p className="text-muted text-base leading-relaxed line-clamp-2 font-light opacity-80 group-hover:opacity-100 transition-opacity">
                        {story.summary}
                      </p>
                      <div className="flex items-center gap-6 pt-4 opacity-0 group-hover:opacity-100 transition-all duration-700 -translate-x-4 group-hover:translate-x-0">
                        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent font-bold">Strategic Analysis</span>
                        <div className="w-12 h-px bg-accent/40" />
                        <div className="flex items-center gap-2 text-accent/60 group-hover:text-accent transition-colors">
                          <Video className="w-3 h-3" />
                          <span className="text-[9px] font-mono uppercase tracking-widest">Visual Intel Available</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-accent animate-pulse" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right Column: Insights & Navigator */}
            <div className="lg:col-span-5">
              <div className="sticky top-32 space-y-10">
                <AnimatePresence mode="wait">
                  {!selectedStory ? (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-12 border border-dashed border-line rounded-[2rem] text-center bg-white/[0.02] backdrop-blur-sm"
                    >
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-line">
                        <Layers className="w-8 h-8 text-muted/40" />
                      </div>
                      <h4 className="text-xl font-serif mb-3 italic">Select Intelligence Node</h4>
                      <p className="text-muted text-sm font-light leading-relaxed">
                        Choose an article to generate an AI-powered strategic briefing tailored to your profile.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="briefing"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-8"
                    >
                      <div className="p-8 glass-card rounded-[2rem] shadow-2xl relative overflow-hidden group/card">
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                          <Zap className="w-32 h-32 text-accent" />
                        </div>

                        <div className="relative space-y-8">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-[0_0_20px_var(--accent-glow)]">
                                <Zap className="w-4 h-4 text-black fill-current" />
                              </div>
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent block">Strategic Intel</span>
                                <span className="text-[9px] font-mono uppercase tracking-widest text-muted">Briefing v2.4</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={videoUrl ? () => setShowVideoStudio(true) : handleGenerateVideo}
                                className={cn(
                                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 group/btn shadow-[0_0_15px_var(--accent-glow)]",
                                  videoUrl ? "bg-green-500 hover:bg-green-600 text-black" : "bg-accent hover:bg-accent/90 text-black"
                                )}
                              >
                                {videoUrl ? <Play className="w-4 h-4 fill-current" /> : <Video className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />}
                                <span className="text-[10px] font-mono uppercase tracking-widest font-bold">
                                  {videoUrl ? "Watch Video" : "Visual Intelligence"}
                                </span>
                              </button>
                              <button 
                                onClick={handleGeneratePPT}
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-300 border border-line group/btn"
                                title="Generate PPT Outline"
                              >
                                <Presentation className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                <span className="text-[10px] font-mono uppercase tracking-widest font-bold">PPT Outline</span>
                              </button>
                              <button className="p-2 hover:bg-white/10 rounded-xl transition-colors border border-line"><Bookmark className="w-4 h-4" /></button>
                            </div>
                          </div>

                          {briefingLoading ? (
                            <div className="py-24 flex flex-col items-center gap-8">
                              <div className="relative">
                                <Loader2 className="w-12 h-12 text-accent animate-spin" />
                                <div className="absolute inset-0 w-12 h-12 border border-accent/20 rounded-full animate-ping" />
                              </div>
                              <div className="text-center space-y-2">
                                <p className="text-[10px] font-mono text-accent uppercase tracking-[0.4em] animate-pulse">Neural Synthesis</p>
                                <p className="text-[9px] font-mono text-muted uppercase tracking-widest">Optimizing for {persona} profile</p>
                              </div>
                            </div>
                          ) : briefing && (
                            <div className="space-y-10">
                              <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4 flex-1">
                                    <h4 className="text-[10px] font-mono text-accent uppercase tracking-[0.4em] font-bold">Overview</h4>
                                    <div className="h-px flex-1 bg-gradient-to-r from-accent/30 to-transparent" />
                                  </div>
                                  {videoUrl ? (
                                    <button 
                                      onClick={() => setShowVideoStudio(true)}
                                      className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg transition-all text-[9px] font-mono uppercase tracking-widest font-bold group/btn"
                                    >
                                      <Play className="w-3 h-3 group-hover/btn:scale-110 transition-transform fill-current" />
                                      Watch Video
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={handleGenerateVideo}
                                      className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded-lg transition-all text-[9px] font-mono uppercase tracking-widest font-bold group/btn"
                                    >
                                      <Video className="w-3 h-3 group-hover/btn:scale-110 transition-transform" />
                                      Visual Explainer
                                    </button>
                                  )}
                                </div>
                                <p className="text-base leading-relaxed text-gray-300 font-light italic serif">
                                  {briefing.overview}
                                </p>
                              </div>

                              <div className="p-10 bg-accent/5 border border-accent/30 rounded-[2.5rem] relative group/insight overflow-hidden glow-hover royal-border shimmer">
                                <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent/10 rounded-full blur-[100px] opacity-60" />
                                <div className="flex items-center gap-4 text-accent mb-6">
                                  <Sparkles className="w-6 h-6 shadow-[0_0_15px_var(--accent)]" />
                                  <span className="text-[11px] font-mono uppercase tracking-[0.4em] font-bold gold-text">Strategic Persona Insight</span>
                                </div>
                                <p className="text-2xl font-serif italic text-white/95 leading-snug tracking-tight">
                                  {language === 'HI' ? "यह अंतर्दृष्टि आपके व्यक्तिगत प्रोफाइल के आधार पर तैयार की गई है।" : briefing.personaInsight}
                                </p>
                              </div>

                              <div className="space-y-8">
                                <h4 className="text-[10px] font-mono text-muted uppercase tracking-[0.4em] flex items-center gap-4">
                                  <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
                                  Key Intelligence Nodes
                                </h4>
                                <div className="grid grid-cols-1 gap-6">
                                  {briefing.keyTakeaways.map((t, i) => (
                                    <div key={i} className="flex gap-8 p-6 rounded-[2rem] bg-accent/5 border border-accent/20 hover:border-accent/50 transition-all group/item glow-hover shimmer relative overflow-hidden">
                                      <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-30 group-hover:opacity-100 transition-opacity" />
                                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-mono text-xs font-bold border border-accent/20 group-hover:bg-accent group-hover:text-black transition-all">
                                        0{i+1}
                                      </div>
                                      <p className="text-base leading-relaxed font-light text-white/90 italic">{t}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {briefing.timeline && briefing.timeline.length > 0 && (
                                <div className="space-y-6">
                                  <h4 className="text-[10px] font-mono text-muted uppercase tracking-[0.3em]">Story Evolution</h4>
                                  <div className="space-y-6 border-l border-line ml-2 pl-8">
                                    {briefing.timeline.map((item, i) => (
                                      <div key={i} className="relative group/timeline">
                                        <div className="absolute -left-[37px] top-1.5 w-2.5 h-2.5 rounded-full bg-black border-2 border-accent group-hover/timeline:scale-125 transition-transform" />
                                        <p className="text-[10px] font-mono text-accent mb-1.5 uppercase tracking-widest">{item.date}</p>
                                        <p className="text-xs text-muted leading-relaxed font-light">{item.event}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Navigator Chat */}
                              <div className="pt-12 border-t border-line space-y-8">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                                      <MessageSquare className="w-5 h-5 text-accent" />
                                    </div>
                                    <div>
                                      <span className="text-[11px] font-mono uppercase tracking-[0.4em] text-accent font-bold block">Sovereign Navigator</span>
                                      <span className="text-[8px] font-mono text-muted uppercase tracking-widest">Neural Intelligence Protocol v3.1</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/5 border border-accent/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                    <span className="text-[9px] font-mono text-accent uppercase font-bold">Active</span>
                                  </div>
                                </div>
                                
                                <div className="max-h-96 overflow-y-auto space-y-8 pr-6 custom-scrollbar">
                                  {chat.map((c, i) => (
                                    <div key={i} className="space-y-4">
                                      <div className="flex justify-end">
                                        <div className="max-w-[80%] bg-accent/10 border border-accent/30 px-6 py-4 rounded-[2rem] rounded-tr-none shadow-xl">
                                          <p className="text-sm font-medium text-white leading-relaxed">{c.q}</p>
                                        </div>
                                      </div>
                                      <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-accent/5 border border-accent/20 flex-shrink-0 flex items-center justify-center mt-1">
                                          <Sparkles className="w-4 h-4 text-accent/50" />
                                        </div>
                                        <div className="flex-1 text-sm text-white/80 leading-relaxed prose prose-invert prose-sm max-w-none font-light italic bg-white/[0.02] p-6 rounded-[2rem] rounded-tl-none border border-line">
                                          <ReactMarkdown>{c.a}</ReactMarkdown>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="space-y-4">
                                  <div className="flex flex-wrap gap-2">
                                    {briefing.relatedQuestions.map((q, i) => (
                                      <button 
                                        key={i}
                                        onClick={() => { setQuestion(q); }}
                                        className="text-[9px] bg-white/5 hover:bg-accent/10 border border-line hover:border-accent/30 px-4 py-2 rounded-full transition-all text-muted hover:text-accent font-mono uppercase tracking-widest"
                                      >
                                        {q}
                                      </button>
                                    ))}
                                  </div>

                                  <form onSubmit={handleAsk} className="relative group/input">
                                    <input 
                                      type="text" 
                                      value={question}
                                      onChange={(e) => setQuestion(e.target.value)}
                                      placeholder="Inquire further..."
                                      className="w-full bg-white/5 border border-line rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-accent/50 focus:bg-white/[0.08] transition-all pr-14 font-light"
                                    />
                                    <button 
                                      type="submit"
                                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-accent hover:bg-accent hover:text-black rounded-xl transition-all"
                                    >
                                      <ChevronRight className="w-5 h-5" />
                                    </button>
                                  </form>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Market Pulse Widget */}
                <div className="p-10 glass-card rounded-[2.5rem] relative overflow-hidden group/market glow-hover shimmer">
                  <div className="absolute top-0 right-0 p-10 opacity-[0.05] pointer-events-none group-hover/market:scale-110 transition-transform duration-1000">
                    <TrendingUp className="w-48 h-48" />
                  </div>
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/5 rounded-xl border border-line group-hover/market:border-accent/30 transition-colors">
                        <BarChart3 className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white font-bold block">Market Pulse</span>
                        <span className="text-[8px] font-mono uppercase tracking-widest text-muted">Global Indices</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                      <div className="relative">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-green-500 animate-ping opacity-40" />
                      </div>
                      <span className="text-[8px] font-mono text-green-500 uppercase tracking-widest font-bold">Live</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-3">
                      <p className="text-[9px] text-muted uppercase tracking-[0.3em] font-mono">NIFTY 50</p>
                      <p className="text-3xl font-mono tracking-tighter text-white">22,453.20</p>
                      <div className="flex items-center gap-2 text-green-500">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-mono font-bold">+0.45%</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[9px] text-muted uppercase tracking-[0.3em] font-mono">SENSEX</p>
                      <p className="text-3xl font-mono tracking-tighter text-white">73,917.03</p>
                      <div className="flex items-center gap-2 text-green-500">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-mono font-bold">+0.38%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-10 pt-8 border-t border-line flex items-center justify-between">
                    <div className="flex gap-1">
                      {[...Array(20)].map((_, i) => (
                        <div 
                          key={i} 
                          className="w-1 h-4 bg-accent/20 rounded-full"
                          style={{ 
                            height: `${Math.random() * 16 + 4}px`,
                            opacity: Math.random() * 0.5 + 0.2
                          }} 
                        />
                      ))}
                    </div>
                    <button className="text-[9px] font-mono uppercase tracking-widest text-muted hover:text-accent transition-colors">View Terminal</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-line mt-24 px-6 py-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <h2 className="text-3xl font-serif italic mb-6">ET Pulse</h2>
            <p className="text-muted text-sm max-w-md leading-relaxed">
              Redefining business intelligence for the modern era. Personalized, interactive, and powered by advanced AI to keep you ahead of the curve.
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted mb-6">Product</h4>
            <ul className="space-y-4 text-sm">
              <li><a href="#" className="hover:text-accent transition-colors">Personalized Feed</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">News Navigator</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Story Arcs</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Vernacular Engine</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted mb-6">Connect</h4>
            <ul className="space-y-4 text-sm">
              <li><a href="#" className="hover:text-accent transition-colors">Twitter</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">LinkedIn</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Newsletter</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">API Access</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-12 border-t border-line flex flex-col md:row items-center justify-between gap-6">
          <p className="text-[10px] font-mono text-muted uppercase tracking-widest">© 2026 ET Pulse. All rights reserved.</p>
          <div className="flex gap-8 text-[10px] font-mono text-muted uppercase tracking-widest">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Cookies</a>
          </div>
        </div>
      </footer>

      {/* Video Studio Modal */}
      <AnimatePresence>
        {showVideoStudio && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-4xl w-full bg-[#111] border border-line rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/20 rounded-lg">
                    <Video className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif italic">AI News Video Studio</h3>
                    <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Broadcast-Quality Synthesis</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowVideoStudio(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                  {/* Video Preview */}
                  <div className="md:col-span-7 aspect-video bg-black rounded-[2rem] border border-line overflow-hidden flex items-center justify-center relative group shadow-2xl">
                    {videoLoading ? (
                      <div className="text-center space-y-6">
                        <div className="relative mx-auto w-16 h-16">
                          <Loader2 className="w-16 h-16 text-accent animate-spin" />
                          <div className="absolute inset-0 w-16 h-16 border-2 border-accent/20 rounded-full animate-ping" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-mono text-accent uppercase tracking-[0.4em] animate-pulse">Synthesis in Progress</p>
                          <p className="text-[9px] font-mono text-muted uppercase tracking-widest">{videoStatus}</p>
                        </div>
                      </div>
                    ) : videoUrl ? (
                      <VideoPlayer 
                        videoUrl={videoUrl} 
                        audioUrl={audioUrl} 
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="text-center space-y-6">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-line group-hover:border-accent/30 transition-colors">
                          <Video className="w-8 h-8 text-muted/40" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-serif italic">Ready for Broadcast</p>
                          <p className="text-[9px] font-mono text-muted uppercase tracking-widest">Click below to initiate neural render</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Controls & Details */}
                  <div className="md:col-span-5 space-y-8">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-accent font-mono text-[9px] uppercase tracking-[0.3em]">
                        <span className="w-4 h-px bg-accent" />
                        Production Pipeline
                      </div>
                      <h4 className="text-2xl font-serif leading-tight text-white/90">{selectedStory?.title}</h4>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-5 bg-white/[0.03] border border-line rounded-2xl group/step hover:bg-white/[0.05] transition-colors">
                        <div className="p-2 bg-accent/10 rounded-lg group-hover/step:bg-accent/20 transition-colors">
                          <Zap className="w-5 h-5 text-accent" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold uppercase tracking-widest">Neural Narration</p>
                          <p className="text-[9px] text-muted uppercase tracking-widest">Voice: Fenrir / 24kHz</p>
                        </div>
                        {audioUrl && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
                      </div>
                      <div className="flex items-center gap-4 p-5 bg-white/[0.03] border border-line rounded-2xl group/step hover:bg-white/[0.05] transition-colors">
                        <div className="p-2 bg-accent/10 rounded-lg group-hover/step:bg-accent/20 transition-colors">
                          <Layers className="w-5 h-5 text-accent" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold uppercase tracking-widest">Visual Synthesis</p>
                          <p className="text-[9px] text-muted uppercase tracking-widest">Engine: Veo 3.1 / 1080p</p>
                        </div>
                        {videoUrl && <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
                      </div>
                    </div>

                    {!videoUrl && !videoLoading && (
                      <button 
                        onClick={handleGenerateVideo}
                        className="w-full py-4 bg-accent hover:bg-accent/90 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 group"
                      >
                        <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        Generate Broadcast Briefing
                      </button>
                    )}

                    {videoUrl && (
                      <div className="flex gap-4">
                        <button className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                          <Download className="w-4 h-4" />
                          Export Video
                        </button>
                        <button className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                          <Share2 className="w-4 h-4" />
                          Share Pulse
                        </button>
                      </div>
                    )}

                    <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5" />
                      <p className="text-[10px] text-blue-400 leading-relaxed">
                        Video generation uses Veo 3.1 and may take 2-3 minutes. Ensure you have a valid API key selected.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PPT Modal */}
      <AnimatePresence>
        {showPptModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-4xl max-h-[85vh] glass-card rounded-[2.5rem] border border-accent/20 overflow-hidden flex flex-col relative"
            >
              {/* Header */}
              <div className="p-8 border-b border-line flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center border border-accent/20">
                    <Presentation className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif italic">Presentation Intelligence</h3>
                    <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Strategic Slide Deck Outline</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {pptOutline && (
                    <button 
                      onClick={() => copyToClipboard(pptOutline)}
                      className="flex items-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl border border-accent/20 transition-all text-[10px] font-mono uppercase tracking-widest font-bold"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Copied!" : "Copy Outline"}
                    </button>
                  )}
                  <button 
                    onClick={() => setShowPptModal(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {pptLoading ? (
                  <div className="h-full flex flex-col items-center justify-center gap-6">
                    <div className="relative">
                      <Loader2 className="w-12 h-12 text-accent animate-spin" />
                      <div className="absolute inset-0 w-12 h-12 border border-accent/20 rounded-full animate-ping" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-[10px] font-mono text-accent uppercase tracking-[0.4em] animate-pulse">Synthesizing Slides</p>
                      <p className="text-[9px] font-mono text-muted uppercase tracking-widest">Structuring strategic narrative...</p>
                    </div>
                  </div>
                ) : pptOutline ? (
                  <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-accent prose-headings:font-serif prose-headings:italic">
                    <ReactMarkdown>{pptOutline}</ReactMarkdown>
                  </div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="p-6 bg-accent/5 border-t border-accent/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-accent/60" />
                  <p className="text-[10px] text-muted leading-relaxed">
                    This outline is optimized for a {persona} audience. Use it as a foundation for your strategic deck.
                  </p>
                </div>
                <button 
                  onClick={() => setShowPptModal(false)}
                  className="px-6 py-2 bg-accent text-black rounded-xl text-[10px] font-mono uppercase tracking-widest font-bold hover:bg-accent/90 transition-all"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back to Top Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-10 right-10 z-[60] p-5 rounded-full glass-card border border-accent/30 text-accent hover:bg-accent hover:text-black transition-all shadow-2xl glow-hover group shimmer"
      >
        <ChevronRight className="w-6 h-6 -rotate-90 group-hover:-translate-y-1 transition-transform" />
      </motion.button>
    </div>
  );
}

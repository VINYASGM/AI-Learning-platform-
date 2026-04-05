import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Lightbulb, BookOpen, Paperclip, Mic, X, FileText, Image, Music, Film, Code, AlertCircle, MicOff } from 'lucide-react';
import { useLearnerState } from '../../context/LearnerStateContext';
import { fileUploadService, UploadedFile } from '../../services/FileUploadService';
import { voiceInputService, VoiceState } from '../../services/VoiceInputService';

export function InputArea() {
  const [text, setText] = useState('');
  const { sendMessage, isTyping } = useLearnerState();
  
  // File upload state
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice input state
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isVoiceSupported] = useState(() => voiceInputService.isSupported());

  // ─── File Upload Logic ───────────────────────────────────────

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setFileError(null);
    setIsProcessingFile(true);

    try {
      const newFiles: UploadedFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const processed = await fileUploadService.processFile(files[i]);
        newFiles.push(processed);
      }
      setAttachedFiles(prev => [...prev, ...newFiles]);
    } catch (err: any) {
      setFileError(err.message || 'Failed to process file');
      setTimeout(() => setFileError(null), 5000);
    } finally {
      setIsProcessingFile(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setAttachedFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file) fileUploadService.revokePreview(file);
      return prev.filter(f => f.id !== fileId);
    });
  }, []);

  const clearAllFiles = useCallback(() => {
    attachedFiles.forEach(f => fileUploadService.revokePreview(f));
    setAttachedFiles([]);
  }, [attachedFiles]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      attachedFiles.forEach(f => fileUploadService.revokePreview(f));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Voice Input Logic ───────────────────────────────────────

  const toggleVoice = useCallback(() => {
    setVoiceError(null);
    voiceInputService.toggle({
      onTranscript: (transcript, isFinal) => {
        setText(transcript);
      },
      onStateChange: (state) => {
        setVoiceState(state);
      },
      onError: (error) => {
        setVoiceError(error);
        setTimeout(() => setVoiceError(null), 5000);
      },
    });
  }, []);

  // Stop voice on unmount
  useEffect(() => {
    return () => voiceInputService.stop();
  }, []);

  // ─── Send Logic ──────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const hasText = text.trim().length > 0;
    const hasFiles = attachedFiles.length > 0;
    
    if ((!hasText && !hasFiles) || isTyping) return;

    // If only files, add a default prompt
    const finalText = hasText 
      ? text 
      : `Please analyze the attached file${attachedFiles.length > 1 ? 's' : ''}.`;

    sendMessage(finalText, undefined, attachedFiles.length > 0 ? attachedFiles : undefined);
    setText('');
    clearAllFiles();

    // Stop voice if still listening
    if (voiceState === 'listening') {
      voiceInputService.stop();
    }
  }, [text, attachedFiles, isTyping, sendMessage, clearAllFiles, voiceState]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const requestHint = () => {
    sendMessage("I'm stuck. Can you give me a small hint to help me figure out the next step?");
  };

  const requestExample = () => {
    sendMessage("Can you show me a similar example to help me understand?");
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'image': return <Image size={12} />;
      case 'document': return <FileText size={12} />;
      case 'audio': return <Music size={12} />;
      case 'video': return <Film size={12} />;
      case 'code': return <Code size={12} />;
      default: return <FileText size={12} />;
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gradient-to-t from-background via-background to-transparent z-10 pb-6">
      <div className="max-w-3xl mx-auto">
        {/* Scaffolded Help Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, type: "spring" }}
          className="flex flex-wrap gap-2 mb-4"
        >
          <motion.button 
            onClick={requestHint}
            disabled={isTyping}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm text-xs font-semibold ${isTyping ? 'opacity-50 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:shadow-md'} transition-all`}
          >
            <Lightbulb size={14} className="text-yellow-500" />
            <span>I need a hint</span>
          </motion.button>
          <motion.button 
            onClick={requestExample}
            disabled={isTyping}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border border-border/60 bg-card/80 backdrop-blur-sm text-xs font-semibold ${isTyping ? 'opacity-50 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:shadow-md'} transition-all`}
          >
            <BookOpen size={14} className="text-blue-500" />
            <span>Show an example</span>
          </motion.button>
        </motion.div>

        {/* Error Messages */}
        <AnimatePresence>
          {(fileError || voiceError) && (
            <motion.div
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs"
            >
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{fileError || voiceError}</span>
              <button
                onClick={() => { setFileError(null); setVoiceError(null); }}
                className="ml-auto p-0.5 hover:bg-red-500/20 rounded-full transition-colors"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Preview Chips */}
        <AnimatePresence>
          {attachedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-3 flex flex-wrap gap-2"
            >
              {attachedFiles.map(file => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card/90 border border-border/60 backdrop-blur-sm group"
                >
                  {file.previewUrl ? (
                    <img 
                      src={file.previewUrl} 
                      alt={file.name}
                      className="w-8 h-8 rounded-lg object-cover border border-border/50"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                      {getCategoryIcon(file.category)}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{file.name}</span>
                    <span className="text-[10px] text-muted-foreground">{fileUploadService.formatSize(file.size)}</span>
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 rounded-full text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Input Field */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, type: "spring", stiffness: 200, damping: 20 }}
          className={`relative flex items-end gap-2 bg-card/90 backdrop-blur-xl border rounded-[2rem] p-2 shadow-lg focus-within:shadow-xl transition-all duration-300 ${
            voiceState === 'listening' 
              ? 'border-red-500/60 ring-4 ring-red-500/10 focus-within:border-red-500/60 focus-within:ring-red-500/10' 
              : 'border-border/50 focus-within:border-foreground/30 focus-within:ring-4 focus-within:ring-foreground/5'
          }`}
        >
          {/* Left Buttons: File Attach */}
          <div className="flex gap-1 pb-1 pl-2">
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile || isTyping}
              className={`p-2.5 transition-colors rounded-full ${
                isProcessingFile
                  ? 'text-muted-foreground/50 cursor-wait animate-pulse'
                  : attachedFiles.length > 0
                    ? 'text-blue-500 bg-blue-500/10 hover:bg-blue-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title="Attach file (images, docs, audio, video, code)"
            >
              <Paperclip size={18} />
            </motion.button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/*,audio/*,video/*,.py,.java,.ts,.tsx,.jsx,.json,.md,.csv,.xml,.js,.html,.css"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload-input"
            />
          </div>

          {/* Text Area */}
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
            placeholder={
              voiceState === 'listening' 
                ? '🎤 Listening... speak now' 
                : attachedFiles.length > 0
                  ? 'Add a message about your file(s), or just send...'
                  : 'Type your answer or ask for help...'
            }
            className="flex-1 max-h-32 min-h-[44px] bg-transparent border-0 focus:ring-0 resize-none py-3.5 px-2 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
            rows={1}
          />

          {/* Right Buttons: Mic + Send */}
          <div className="flex gap-1 pb-1 pr-1">
            {/* Microphone Button */}
            {isVoiceSupported && (
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleVoice}
                disabled={isTyping}
                className={`p-2.5 transition-all rounded-full ${
                  voiceState === 'listening'
                    ? 'text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/30 animate-pulse'
                    : voiceState === 'error'
                      ? 'text-red-400 hover:bg-red-500/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={
                  voiceState === 'listening' 
                    ? 'Stop recording' 
                    : 'Start voice input'
                }
              >
                {voiceState === 'listening' ? (
                  <MicOff size={18} />
                ) : (
                  <Mic size={18} />
                )}
              </motion.button>
            )}

            {/* Voice State Indicator (visible on desktop when listening) */}
            {voiceState === 'listening' && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="hidden sm:flex items-center gap-1.5 px-3 text-xs text-red-400 font-medium"
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>REC</span>
              </motion.div>
            )}

            {/* Send Button */}
            <motion.button 
              onClick={handleSend}
              disabled={isTyping || (!text.trim() && attachedFiles.length === 0)}
              whileHover={{ scale: 1.05, rotate: -10 }}
              whileTap={{ scale: 0.95 }}
              className={`p-3 rounded-full shadow-md hover:shadow-lg transition-all ${
                (!text.trim() && attachedFiles.length === 0) || isTyping 
                  ? 'bg-muted text-muted-foreground' 
                  : 'bg-gradient-to-br from-foreground to-foreground/90 text-background'
              }`}
            >
              <Send size={18} className="ml-0.5" />
            </motion.button>
          </div>
        </motion.div>

        {/* File type hint */}
        <AnimatePresence>
          {attachedFiles.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] text-muted-foreground/60 text-center mt-2"
            >
              Gemini will analyze your file(s) in the context of the current lesson
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

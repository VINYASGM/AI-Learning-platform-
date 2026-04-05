/**
 * VoiceInputService
 * 
 * Wraps the Web Speech API (SpeechRecognition) for voice input.
 * Provides a clean interface with state management, interim results,
 * and automatic stop on silence.
 */

// ─── Types ────────────────────────────────────────────────────

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export interface VoiceInputCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onStateChange: (state: VoiceState) => void;
  onError: (error: string) => void;
}

// ─── Compatibility ────────────────────────────────────────────

const SpeechRecognitionAPI = 
  (typeof window !== 'undefined') 
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) 
    : null;

// ─── Service ──────────────────────────────────────────────────

export class VoiceInputService {
  private recognition: any | null = null;
  private isListening = false;
  private callbacks: VoiceInputCallbacks | null = null;
  private accumulatedTranscript = '';
  private silenceTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Check if the browser supports speech recognition.
   */
  public isSupported(): boolean {
    return !!SpeechRecognitionAPI;
  }

  /**
   * Start listening for voice input.
   */
  public start(callbacks: VoiceInputCallbacks): void {
    if (!SpeechRecognitionAPI) {
      callbacks.onError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      callbacks.onStateChange('error');
      return;
    }

    if (this.isListening) {
      this.stop();
      return;
    }

    this.callbacks = callbacks;
    this.accumulatedTranscript = '';

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.lang = 'en-US';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      callbacks.onStateChange('listening');
    };

    this.recognition.onresult = (event: any) => {
      // Reset silence timer on any result
      this.resetSilenceTimer();

      let interimTranscript = '';
      let finalTranscript = this.accumulatedTranscript;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          this.accumulatedTranscript = finalTranscript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Send the full accumulated + interim text
      const displayText = (finalTranscript + interimTranscript).trim();
      const isFinal = interimTranscript === '';
      callbacks.onTranscript(displayText, isFinal);
    };

    this.recognition.onerror = (event: any) => {
      console.warn('[Voice] Recognition error:', event.error);
      
      // Don't report "aborted" as an error — it's a normal stop
      if (event.error === 'aborted') return;
      
      if (event.error === 'not-allowed') {
        callbacks.onError('Microphone access was denied. Please allow microphone permissions.');
      } else if (event.error === 'no-speech') {
        callbacks.onError('No speech detected. Try speaking louder.');
      } else {
        callbacks.onError(`Voice recognition error: ${event.error}`);
      }
      
      this.isListening = false;
      callbacks.onStateChange('error');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.clearSilenceTimer();
      
      // Deliver final transcript
      if (this.accumulatedTranscript.trim()) {
        callbacks.onTranscript(this.accumulatedTranscript.trim(), true);
      }
      callbacks.onStateChange('idle');
    };

    try {
      this.recognition.start();
      // Auto-stop after 30 seconds of total recording
      this.silenceTimeout = setTimeout(() => {
        this.stop();
      }, 30000);
    } catch (err) {
      callbacks.onError('Failed to start voice recognition. Please try again.');
      callbacks.onStateChange('error');
    }
  }

  /**
   * Stop listening.
   */
  public stop(): void {
    this.clearSilenceTimer();
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    this.isListening = false;
  }

  /**
   * Toggle listening state.
   */
  public toggle(callbacks: VoiceInputCallbacks): void {
    if (this.isListening) {
      this.stop();
    } else {
      this.start(callbacks);
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  // ── Private ──────────────────────────────────────────────────

  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    // Auto-stop after 5 seconds of silence
    this.silenceTimeout = setTimeout(() => {
      if (this.isListening) {
        console.log('[Voice] Auto-stopping after silence');
        this.stop();
      }
    }, 5000);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }
}

// Singleton
export const voiceInputService = new VoiceInputService();

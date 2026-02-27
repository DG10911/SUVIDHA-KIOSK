import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Volume2, VolumeX, ZoomIn, ZoomOut, Sun, Moon, Ear, Hand, X, Accessibility } from "lucide-react";

const WARD_LIST = Array.from({ length: 12 }, (_, i) => `Ward ${i + 1}`);

interface AccessibilityState {
  enabled: boolean;
  screenReader: boolean;
  highContrast: boolean;
  largeText: boolean;
  voiceNav: boolean;
  audioFeedback: boolean;
  fontSize: number;
}

const DEFAULT_STATE: AccessibilityState = {
  enabled: false,
  screenReader: false,
  highContrast: false,
  largeText: false,
  voiceNav: false,
  audioFeedback: true,
  fontSize: 16,
};

function speak(text: string, rate = 0.9) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-IN";
    utter.rate = rate;
    utter.pitch = 1;
    utter.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(v => v.lang.startsWith("hi"));
    const enVoice = voices.find(v => v.lang.startsWith("en"));
    if (enVoice) utter.voice = enVoice;
    window.speechSynthesis.speak(utter);
  }
}

export default function AccessibilityMode() {
  const [state, setState] = useState<AccessibilityState>(() => {
    try {
      const saved = localStorage.getItem("accessibilityMode");
      return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : DEFAULT_STATE;
    } catch { return DEFAULT_STATE; }
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const announcerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("accessibilityMode", JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    if (state.highContrast) {
      root.classList.add("high-contrast-mode");
    } else {
      root.classList.remove("high-contrast-mode");
    }
    if (state.largeText) {
      root.style.fontSize = `${state.fontSize}px`;
      root.classList.add("large-text-mode");
    } else {
      root.style.fontSize = "";
      root.classList.remove("large-text-mode");
    }
    return () => {
      root.classList.remove("high-contrast-mode", "large-text-mode");
      root.style.fontSize = "";
    };
  }, [state.highContrast, state.largeText, state.fontSize]);

  const announce = useCallback((text: string) => {
    if (state.audioFeedback) speak(text);
    if (announcerRef.current) {
      announcerRef.current.textContent = text;
    }
  }, [state.audioFeedback]);

  useEffect(() => {
    if (!state.screenReader) return;
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const label = target.getAttribute("aria-label") ||
        target.getAttribute("title") ||
        target.textContent?.trim()?.slice(0, 80) || "";
      const role = target.getAttribute("role") || target.tagName.toLowerCase();
      if (label) announce(`${role}: ${label}`);
    };
    document.addEventListener("focusin", handleFocus);
    return () => document.removeEventListener("focusin", handleFocus);
  }, [state.screenReader, announce]);

  useEffect(() => {
    if (!state.enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "a") {
        e.preventDefault();
        setPanelOpen(p => !p);
        announce("Accessibility panel toggled");
      }
      if (e.altKey && e.key === "h") {
        e.preventDefault();
        window.location.href = "/";
        announce("Navigating to home page");
      }
      if (e.altKey && e.key === "c") {
        e.preventDefault();
        window.location.href = "/complaint-center";
        announce("Navigating to complaint center");
      }
      if (e.altKey && e.key === "s") {
        e.preventDefault();
        window.location.href = "/service-request";
        announce("Navigating to services");
      }
      if (e.altKey && e.key === "v") {
        e.preventDefault();
        toggleVoiceNav();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [state.enabled, announce]);

  const toggleVoiceNav = useCallback(() => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      announce("Voice navigation is not supported in this browser");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      announce("Voice navigation stopped");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-IN";

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1];
      if (last.isFinal) {
        const command = last[0].transcript.toLowerCase().trim();
        handleVoiceCommand(command);
      }
    };
    recognition.onerror = () => { setListening(false); };
    recognition.onend = () => { setListening(false); };
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
    announce("Voice navigation started. Say a command like: go home, file complaint, check status, emergency, help");
  }, [listening, announce]);

  const handleVoiceCommand = (command: string) => {
    const nav: Record<string, [string, string]> = {
      "home": ["/", "Navigating to home"],
      "go home": ["/", "Navigating to home"],
      "complaint": ["/complaint-center", "Opening complaint center"],
      "file complaint": ["/complaint-center", "Opening complaint center"],
      "services": ["/service-request", "Opening services"],
      "electricity": ["/electricity", "Opening electricity services"],
      "water": ["/water-bill", "Opening water bill"],
      "gas": ["/gas", "Opening gas services"],
      "emergency": ["/emergency-sos", "Calling emergency SOS"],
      "sos": ["/emergency-sos", "Calling emergency SOS"],
      "profile": ["/profile", "Opening your profile"],
      "documents": ["/documents", "Opening documents"],
      "notifications": ["/notifications", "Opening notifications"],
      "wallet": ["/wallet", "Opening wallet"],
      "schemes": ["/schemes", "Opening government schemes"],
      "appointment": ["/appointments", "Opening appointments"],
      "feedback": ["/feedback", "Opening feedback"],
      "transparency": ["/transparency", "Opening transparency portal"],
      "status": ["/complaint-center", "Opening complaint status checker"],
      "help": ["", "Available commands: go home, file complaint, services, electricity, water, gas, emergency, profile, documents, notifications, wallet, schemes, appointment, feedback, transparency, status"],
    };

    for (const [key, [url, msg]] of Object.entries(nav)) {
      if (command.includes(key)) {
        announce(msg);
        if (url) setTimeout(() => { window.location.href = url; }, 500);
        return;
      }
    }
    announce(`I didn't understand: ${command}. Say "help" for available commands.`);
  };

  const toggle = (key: keyof AccessibilityState) => {
    setState(prev => {
      const newVal = !prev[key];
      const labels: Record<string, string> = {
        screenReader: `Screen reader ${newVal ? "enabled" : "disabled"}`,
        highContrast: `High contrast mode ${newVal ? "enabled" : "disabled"}`,
        largeText: `Large text mode ${newVal ? "enabled" : "disabled"}`,
        audioFeedback: `Audio feedback ${newVal ? "enabled" : "disabled"}`,
      };
      if (labels[key]) announce(labels[key]);
      return { ...prev, [key]: newVal };
    });
  };

  const adjustFontSize = (delta: number) => {
    setState(prev => {
      const newSize = Math.max(12, Math.min(28, prev.fontSize + delta));
      announce(`Font size: ${newSize} pixels`);
      return { ...prev, fontSize: newSize, largeText: true };
    });
  };

  if (!state.enabled) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setState(prev => ({ ...prev, enabled: true }));
          announce("Accessibility mode enabled. Press Alt+A to open the accessibility panel.");
        }}
        className="fixed bottom-6 left-6 z-[9999] bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl"
        aria-label="Enable accessibility mode for visually impaired users"
        title="Accessibility Mode"
      >
        <Accessibility className="w-6 h-6" />
      </motion.button>
    );
  }

  return (
    <>
      <div ref={announcerRef} role="status" aria-live="assertive" aria-atomic="true" className="sr-only" />

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setPanelOpen(p => !p)}
        className={`fixed bottom-6 left-6 z-[9999] ${listening ? "bg-red-600 animate-pulse" : "bg-blue-600 hover:bg-blue-700"} text-white p-4 rounded-full shadow-xl`}
        aria-label="Toggle accessibility panel (Alt+A)"
        title="Accessibility Settings"
      >
        <Accessibility className="w-6 h-6" />
      </motion.button>

      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -100, scale: 0.9 }}
            className="fixed bottom-24 left-6 z-[9999] bg-white dark:bg-gray-900 border-2 border-blue-500 rounded-2xl shadow-2xl w-80 max-h-[70vh] overflow-y-auto"
            role="dialog"
            aria-label="Accessibility Settings Panel"
          >
            <div className="bg-blue-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Accessibility className="w-5 h-5" />
                <h2 className="font-bold text-lg">Accessibility</h2>
              </div>
              <button onClick={() => setPanelOpen(false)} className="p-1 hover:bg-blue-700 rounded-lg" aria-label="Close accessibility panel">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <button
                onClick={() => toggle("screenReader")}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition ${state.screenReader ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-700 hover:border-blue-300"}`}
                aria-label={`Screen reader: ${state.screenReader ? "on" : "off"}`}
                aria-pressed={state.screenReader}
              >
                <Ear className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="text-left flex-1">
                  <p className="font-semibold text-sm dark:text-white">Screen Reader</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Read focused elements aloud</p>
                </div>
                <div className={`w-10 h-6 rounded-full transition ${state.screenReader ? "bg-blue-600" : "bg-gray-300"} flex items-center`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${state.screenReader ? "translate-x-5" : "translate-x-1"}`} />
                </div>
              </button>

              <button
                onClick={toggleVoiceNav}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition ${listening ? "border-red-500 bg-red-50 dark:bg-red-900/30 animate-pulse" : "border-gray-200 dark:border-gray-700 hover:border-blue-300"}`}
                aria-label={`Voice navigation: ${listening ? "listening" : "off"}`}
              >
                {listening ? <Volume2 className="w-5 h-5 text-red-600 flex-shrink-0" /> : <VolumeX className="w-5 h-5 text-blue-600 flex-shrink-0" />}
                <div className="text-left flex-1">
                  <p className="font-semibold text-sm dark:text-white">Voice Navigation</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{listening ? "Listening... say a command" : "Navigate with voice commands"}</p>
                </div>
                <div className={`w-10 h-6 rounded-full transition ${listening ? "bg-red-600" : "bg-gray-300"} flex items-center`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${listening ? "translate-x-5" : "translate-x-1"}`} />
                </div>
              </button>

              <button
                onClick={() => toggle("highContrast")}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition ${state.highContrast ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30" : "border-gray-200 dark:border-gray-700 hover:border-blue-300"}`}
                aria-label={`High contrast: ${state.highContrast ? "on" : "off"}`}
                aria-pressed={state.highContrast}
              >
                {state.highContrast ? <Sun className="w-5 h-5 text-yellow-600 flex-shrink-0" /> : <Moon className="w-5 h-5 text-blue-600 flex-shrink-0" />}
                <div className="text-left flex-1">
                  <p className="font-semibold text-sm dark:text-white">High Contrast</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Bold colors, sharp borders</p>
                </div>
                <div className={`w-10 h-6 rounded-full transition ${state.highContrast ? "bg-yellow-600" : "bg-gray-300"} flex items-center`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${state.highContrast ? "translate-x-5" : "translate-x-1"}`} />
                </div>
              </button>

              <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700">
                <Eye className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="text-left flex-1">
                  <p className="font-semibold text-sm dark:text-white">Text Size: {state.fontSize}px</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => adjustFontSize(-2)} className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600" aria-label="Decrease font size">
                    <ZoomOut className="w-4 h-4 dark:text-white" />
                  </button>
                  <button onClick={() => adjustFontSize(2)} className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600" aria-label="Increase font size">
                    <ZoomIn className="w-4 h-4 dark:text-white" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => toggle("audioFeedback")}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition ${state.audioFeedback ? "border-green-500 bg-green-50 dark:bg-green-900/30" : "border-gray-200 dark:border-gray-700 hover:border-blue-300"}`}
                aria-label={`Audio feedback: ${state.audioFeedback ? "on" : "off"}`}
                aria-pressed={state.audioFeedback}
              >
                <Volume2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="text-left flex-1">
                  <p className="font-semibold text-sm dark:text-white">Audio Feedback</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Speak actions and navigation</p>
                </div>
                <div className={`w-10 h-6 rounded-full transition ${state.audioFeedback ? "bg-green-600" : "bg-gray-300"} flex items-center`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${state.audioFeedback ? "translate-x-5" : "translate-x-1"}`} />
                </div>
              </button>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Keyboard Shortcuts</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {[
                    ["Alt + A", "Panel"],
                    ["Alt + H", "Home"],
                    ["Alt + C", "Complaints"],
                    ["Alt + S", "Services"],
                    ["Alt + V", "Voice Nav"],
                    ["Tab", "Navigate"],
                  ].map(([key, action]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-[10px] font-mono dark:text-white">{key}</kbd>
                      <span className="text-gray-600 dark:text-gray-400">{action}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Voice Commands</p>
                <div className="flex flex-wrap gap-1">
                  {["go home", "file complaint", "emergency", "services", "help"].map(cmd => (
                    <span key={cmd} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-medium">"{cmd}"</span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  setState({ ...DEFAULT_STATE, enabled: false });
                  setPanelOpen(false);
                  if (recognitionRef.current) recognitionRef.current.stop();
                  setListening(false);
                  document.documentElement.classList.remove("high-contrast-mode", "large-text-mode");
                  document.documentElement.style.fontSize = "";
                }}
                className="w-full py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition font-medium"
                aria-label="Disable accessibility mode"
              >
                Disable Accessibility Mode
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .high-contrast-mode {
          filter: contrast(1.4);
        }
        .high-contrast-mode * {
          border-color: currentColor !important;
        }
        .large-text-mode button,
        .large-text-mode a,
        .large-text-mode input,
        .large-text-mode select,
        .large-text-mode textarea {
          min-height: 48px;
          font-size: inherit;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechStatus =
  | "unsupported"
  | "idle"
  | "listening"
  | "processing"
  | "error";

export function useSpeechRecognition(lang = "zh-HK") {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
    if (!getSpeechRecognitionCtor()) {
      setStatus("unsupported");
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      setErrorMessage("此浏览器不支持语音识别，请使用下方文字输入。");
      return;
    }

    stop();
    setTranscript("");
    setErrorMessage(null);

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setStatus("listening");
    rec.onerror = (ev) => {
      setStatus("error");
      setErrorMessage(ev.error || "speech_error");
    };
    rec.onend = () => {
      setStatus((s) => (s === "listening" ? "processing" : s));
      recognitionRef.current = null;
    };
    rec.onresult = (ev) => {
      let text = "";
      for (let i = 0; i < ev.results.length; i++) {
        text += ev.results[i][0].transcript;
      }
      setTranscript(text.trim());
    };

    try {
      rec.start();
    } catch {
      setStatus("error");
      setErrorMessage("无法启动麦克风，请检查权限或使用文字输入。");
    }
  }, [lang, stop]);

  return {
    supported,
    status,
    transcript,
    errorMessage,
    start,
    stop,
    clearTranscript: () => setTranscript(""),
  };
}

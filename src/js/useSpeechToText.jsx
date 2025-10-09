import { useEffect, useRef, useState } from 'react';

export default function useSpeechToText() {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [language, setLanguage] = useState(() => {
    // Recupera la lingua dal localStorage o imposta inglese come default
    return localStorage.getItem('speechRecognitionLang') || 'en-US';
  });
  const recognitionRef = useRef(null);
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechRecognitionSupported = !!SpeechRecognition;

  useEffect(() => {
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const speechResult = event.results[i];
        if (speechResult.isFinal) {
          setTranscript((prev) => prev + speechResult[0].transcript + ' ');
        }
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [SpeechRecognition, language]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      // Aggiorna la lingua ogni volta prima di iniziare il riconoscimento
      recognitionRef.current.lang = language;
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem('speechRecognitionLang', newLanguage);
  };

  return { 
    transcript, 
    isListening, 
    startListening, 
    stopListening, 
    setTranscript, 
    speechRecognitionSupported,
    language,
    changeLanguage
  };
}
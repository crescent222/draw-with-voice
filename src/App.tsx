/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { AudioFeatures, HandData } from './types';
import { ArtCanvas } from './components/ArtCanvas';
import { AudioController } from './components/AudioController';
import { HandController } from './components/HandController';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Trash2, 
  SlidersHorizontal,
  Sparkles,
  RefreshCw,
  Maximize2,
  Download
} from 'lucide-react';

export default function App() {
  const [audioFeatures, setAudioFeatures] = useState<AudioFeatures | null>(null);
  const [handData, setHandData] = useState<HandData | null>(null);
  const [paintActive, setPaintActive] = useState<boolean>(true);
  
  // Controls overlays toggles
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [micState, setMicState] = useState<'off' | 'on'>('on');
  const [camState, setCamState] = useState<'off' | 'on'>('on');

  // References to trigger elements under-the-hood in children
  const canvasClearTrigger = useRef<(() => void) | null>(null);
  const innerAudioStartRef = useRef<(() => void) | null>(null);
  const innerAudioStopRef = useRef<(() => void) | null>(null);
  const innerCamStartRef = useRef<(() => void) | null>(null);
  const innerCamStopRef = useRef<(() => void) | null>(null);

  // Audio adjustments synced down to hidden controller via state
  const [audioSensitivity, setAudioSensitivity] = useState<number>(1.5);
  const [audioNoiseFloor, setAudioNoiseFloor] = useState<number>(0.012);

  // Download local offline single-file HTML (1:1 identical experience)
  const handleDownloadHTML = async () => {
    try {
      const response = await fetch('/abstract_acoustic_painting.html');
      if (!response.ok) {
        throw new Error(`Failed to fetch standalone HTML, server responded with ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'abstract_acoustic_painting.html';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to trigger local HTML backup download:', err);
    }
  };

  // Attempt to automatically initialize the microphone and camera streams on load
  useEffect(() => {
    const tryAutoStart = () => {
      if (innerAudioStartRef.current) {
        innerAudioStartRef.current();
      }
      if (innerCamStartRef.current) {
        innerCamStartRef.current();
      }
    };

    // 1. Try after a short delay on mount
    const timer = setTimeout(tryAutoStart, 500);

    // 2. Register global gesture backup triggers to ensure flawless activation instantly on first user interaction
    const handleFirstGesture = () => {
      tryAutoStart();
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };

    window.addEventListener('click', handleFirstGesture);
    window.addEventListener('touchstart', handleFirstGesture);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, []);

  const handleClearCanvasClick = () => {
    if (canvasClearTrigger.current) {
      canvasClearTrigger.current();
    }
  };

  const handleToggleMic = () => {
    if (micState === 'off') {
      if (innerAudioStartRef.current) {
        innerAudioStartRef.current();
        setMicState('on');
        setPaintActive(true);
      }
    } else {
      if (innerAudioStopRef.current) {
        innerAudioStopRef.current();
        setMicState('off');
        setPaintActive(false);
      }
    }
  };

  const handleToggleCam = () => {
    if (camState === 'off') {
      if (innerCamStartRef.current) {
        innerCamStartRef.current();
        setCamState('on');
      }
    } else {
      if (innerCamStopRef.current) {
        innerCamStopRef.current();
        setCamState('off');
      }
    }
  };

  return (
    <div 
      id="art-installation-root" 
      className="w-screen h-screen bg-[#141311] flex flex-col items-center justify-center relative select-none overflow-hidden font-sans antialiased"
    >
      {/* Background gallery ambient spotlights */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900/40 via-[#181614] to-[#0A0A09] pointer-events-none" />

      {/* Strict 1280x720 Canvas Mounting Frame */}
      <div 
        id="composition-1280-720-frame"
        className="relative w-[1280px] h-[720px] max-w-[95vw] max-h-[92vh] aspect-[16/9] border border-neutral-800/85 rounded-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden bg-[#F5F2E6] flex items-center justify-center transition-all duration-300 z-10"
      >
        {/* Generative Interactive Canvas Layer */}
        <ArtCanvas
          audioFeatures={audioFeatures}
          handData={handData}
          paintActive={paintActive}
          onClearTriggered={() => {}}
          clearTriggerRef={canvasClearTrigger}
        />

        {/* 1. ULTRAMINIMALIST OPTION BRIDGE DOCK (Slides up / Fades in on hover) */}
        <div 
          id="musealic-hover-dock"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-2.5 bg-[#FAF8F5]/85 backdrop-blur-md rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-stone-200/50 opacity-15 hover:opacity-100 focus-within:opacity-100 transition-all duration-300 hover:scale-[1.03]"
        >
          {/* Signal Pulse Indicator */}
          <div className="flex items-center gap-2 border-r border-stone-300/60 pr-3 mr-1">
            <span className={`w-2 h-2 rounded-full ${paintActive ? 'bg-red-500 animate-pulse' : 'bg-stone-400'}`} />
            <span className="font-mono text-[9px] font-bold text-stone-500 uppercase tracking-widest">
              {paintActive ? 'Live Canvas' : 'Resting'}
            </span>
          </div>

          {/* Micro Mic Toggle */}
          <button
            id="bar-toggle-mic"
            onClick={handleToggleMic}
            title={micState === 'on' ? "Deactivate Microphone" : "Activate Microphone to Paint with Voice"}
            className={`p-2.5 rounded-full border transition-all duration-200 cursor-pointer flex items-center justify-center ${
              micState === 'on'
                ? 'bg-[#C23122] text-white border-transparent shadow-inner'
                : 'bg-white/60 text-stone-700 border-stone-300 hover:bg-[#F2ECE0]'
            }`}
          >
            {micState === 'on' ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          {/* Micro Camera Gesture Toggle */}
          <button
            id="bar-toggle-cam"
            onClick={handleToggleCam}
            title={camState === 'on' ? "Deactivate Camera Hands Tracking" : "Activate Gestures Control (✊ to Clear)"}
            className={`p-2.5 rounded-full border transition-all duration-200 cursor-pointer flex items-center justify-center ${
              camState === 'on'
                ? 'bg-indigo-600 text-white border-transparent shadow-inner'
                : 'bg-white/60 text-stone-700 border-stone-300 hover:bg-[#F2ECE0]'
            }`}
          >
            {camState === 'on' ? <VideoOff size={15} /> : <Video size={15} />}
          </button>

          {/* Precision Audio Calibration panel Toggle */}
          <button
            id="bar-toggle-settings"
            onClick={() => setShowConfig(!showConfig)}
            title="Fine-tune audio input thresholds"
            className={`p-2.5 rounded-full border transition-all duration-200 cursor-pointer flex items-center justify-center ${
              showConfig
                ? 'bg-stone-900 text-white border-transparent'
                : 'bg-white/60 text-stone-700 border-stone-300 hover:bg-[#F2ECE0]'
            }`}
          >
            <SlidersHorizontal size={15} />
          </button>

          {/* Download Standalone 1:1 HTML File */}
          <button
            id="bar-action-download"
            onClick={handleDownloadHTML}
            title="Download Standalone 1:1 HTML File (Local Single-File Runtime)"
            className="p-2.5 rounded-full bg-white/60 text-stone-700 border border-stone-300 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all duration-200 cursor-pointer flex items-center justify-center"
          >
            <Download size={15} />
          </button>

          {/* Clear Canvas Action */}
          <button
            id="bar-action-clear"
            onClick={handleClearCanvasClick}
            title="Clear Paint trail (or make a clenched fist ✊)"
            className="p-2.5 rounded-full bg-white/60 text-stone-700 border border-stone-300 hover:bg-rose-50 hover:text-[#C23122] hover:border-rose-200 transition-all duration-200 cursor-pointer flex items-center justify-center"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* 2. TRANSLUCENT PRECISION TUNING HUD CARD (Tucked behind settings button) */}
        {showConfig && (
          <div 
            id="paints-interactive-tweaker"
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-72 p-4 bg-[#FAF8F5]/90 backdrop-blur-lg border border-stone-200/60 rounded-2xl shadow-xl flex flex-col gap-3.5 transition-all duration-300 text-xs text-stone-800"
          >
            <div className="flex items-center justify-between border-b border-stone-200/50 pb-1.5">
              <span className="font-sans font-bold text-stone-900 flex items-center gap-1">
                <Sparkles size={12} className="text-stone-700" />
                Vocal Audio Calibration
              </span>
              <button 
                onClick={() => setShowConfig(false)}
                className="text-[10px] text-stone-400 font-mono hover:text-stone-700"
              >
                CLOSE
              </button>
            </div>

            {/* Slider 1: Sensitivity */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-stone-600">Vocal Sensitivity</span>
                <span className="font-mono text-stone-500 font-bold">{audioSensitivity.toFixed(1)}x</span>
              </div>
              <input
                id="audio-feed-sensitivity"
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={audioSensitivity}
                onChange={(e) => setAudioSensitivity(parseFloat(e.target.value))}
                className="w-full accent-stone-900 cursor-pointer h-1.5 bg-stone-200/60 rounded-lg appearance-none"
              />
            </div>

            {/* Slider 2: Noise Threshold */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-stone-600">Noise Threshold</span>
                <span className="font-mono text-stone-500 font-bold">{Math.round(audioNoiseFloor * 1000)}m/s</span>
              </div>
              <input
                id="audio-feed-noise-threshold"
                type="range"
                min="0.001"
                max="0.05"
                step="0.001"
                value={audioNoiseFloor}
                onChange={(e) => setAudioNoiseFloor(parseFloat(e.target.value))}
                className="w-full accent-stone-900 cursor-pointer h-1.5 bg-stone-200/60 rounded-lg appearance-none"
              />
            </div>

            <p className="font-mono text-[9px] text-stone-400 text-center leading-normal">
              Adjust sensitivity to match your bedroom mic or singing proximity.
            </p>
          </div>
        )}

        {/* 3. UNDER-THE-HOOD AUDIO ENGINE DRIVERS */}
        <AudioController
          onFeaturesUpdate={setAudioFeatures}
          paintActive={paintActive}
          onPaintActiveChange={setPaintActive}
          // Bind inner triggers so the floating bar buttons can toggle recording
          audioSensitivity={audioSensitivity}
          audioNoiseFloor={audioNoiseFloor}
          onRegisterStartTrigger={(startFn) => { innerAudioStartRef.current = startFn; }}
          onRegisterStopTrigger={(stopFn) => { innerAudioStopRef.current = stopFn; }}
        />

        <HandController
          onHandUpdate={setHandData}
          onRegisterStartTrigger={(startFn) => { innerCamStartRef.current = startFn; }}
          onRegisterStopTrigger={(stopFn) => { innerCamStopRef.current = stopFn; }}
        />
      </div>

      {/* Tiny subtle technical copyright of high precision gallery context */}
      <div className="mt-4 font-mono text-[10px] text-stone-600 tracking-wider flex items-center gap-4 z-10 select-none">
        <span>EXHIBITED WORK • INTERACTION ACOUSTIC PAINTING SYSTEM</span>
        <span className="opacity-40">•</span>
        <span>1280 × 720 LANDSPACE EXXON STANDARD</span>
      </div>
    </div>
  );
}

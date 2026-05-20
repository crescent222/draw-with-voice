/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { AudioFeatures } from '../types';
import { detectPitch, analyseSpectrum } from '../utils/audio';

interface AudioControllerProps {
  onFeaturesUpdate: (features: AudioFeatures | null) => void;
  paintActive: boolean;
  onPaintActiveChange: (active: boolean) => void;
  audioSensitivity?: number;
  audioNoiseFloor?: number;
  onRegisterStartTrigger?: (startFn: () => void) => void;
  onRegisterStopTrigger?: (stopFn: () => void) => void;
}

export const AudioController: React.FC<AudioControllerProps> = ({
  onFeaturesUpdate,
  paintActive,
  onPaintActiveChange,
  audioSensitivity = 1.5,
  audioNoiseFloor = 0.012,
  onRegisterStartTrigger,
  onRegisterStopTrigger
}) => {
  const [micActive, setMicActive] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastOnsetFrameRef = useRef<number>(0);

  // Buffer state nodes for Pitch Tracker
  const timeBufferRef = useRef<Float32Array | null>(null);
  const freqBufferRef = useRef<Uint8Array | null>(null);

  // Breath stabilizer state
  const silenceTimerRef = useRef<number>(0);

  // Initialize Microphone source
  const startMic = async () => {
    try {
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
        setMicActive(true);
        onPaintActiveChange(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      
      // We want high frequency resolution for pitch matching and low latency
      analyser.fftSize = 2048; 
      analyser.smoothingTimeConstant = 0.4;
      
      source.connect(analyser);
      analyserRef.current = analyser;

      // Audio analysis buffers
      timeBufferRef.current = new Float32Array(analyser.fftSize);
      freqBufferRef.current = new Uint8Array(analyser.frequencyBinCount);

      setMicActive(true);
      onPaintActiveChange(true);
    } catch (err) {
      console.error('Failed to request microphone stream:', err);
      setMicActive(false);
    }
  };

  const stopMic = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    setMicActive(false);
    onPaintActiveChange(false);
    onFeaturesUpdate(null);
  };

  // Register master triggers back up to parent App on mount/updates
  useEffect(() => {
    if (onRegisterStartTrigger) {
      onRegisterStartTrigger(startMic);
    }
  }, [onRegisterStartTrigger]);

  useEffect(() => {
    if (onRegisterStopTrigger) {
      onRegisterStopTrigger(stopMic);
    }
  }, [onRegisterStopTrigger]);

  // Real-time audio processing analysis loop
  useEffect(() => {
    if (!micActive || !analyserRef.current || !timeBufferRef.current || !freqBufferRef.current) return;

    const analyser = analyserRef.current;
    const timeBuff = timeBufferRef.current;
    const freqBuff = freqBufferRef.current;
    const sampleRate = audioContextRef.current?.sampleRate || 44100;

    let lastVolume = 0;

    const analyzeAudioFrame = () => {
      analyser.getFloatTimeDomainData(timeBuff);
      analyser.getByteFrequencyData(freqBuff);

      // 1. Core Pitch Detection via Autocorrelation
      const { pitch, confidence } = detectPitch(timeBuff, sampleRate);
      
      // 2. Volume & Amplitude Calculation (RMS)
      let sumSquares = 0;
      for (let i = 0; i < timeBuff.length; i++) {
        sumSquares += timeBuff[i] * timeBuff[i];
      }
      const rawAmp = Math.sqrt(sumSquares / timeBuff.length);
      const scaledAmp = Math.min(1.0, rawAmp * audioSensitivity);

      // 3. Spectral Energy Profile Analysis
      const spectralFeatures = analyseSpectrum(freqBuff, sampleRate);

      // 4. Onset Beat Accent Detection
      let onset = false;
      const volumeDiff = scaledAmp - lastVolume;
      const currentTimeStr = Date.now();
      
      // Sudden volume rise over critical threshold marks a singing onset beat
      if (volumeDiff > 0.08 && (currentTimeStr - lastOnsetFrameRef.current) > 250) {
        onset = true;
        lastOnsetFrameRef.current = currentTimeStr;
      }
      lastVolume = scaledAmp;

      // 5. Breathing and Silence pause monitoring
      const volumeActive = scaledAmp > audioNoiseFloor;
      let isBreathingPause = false;

      if (!volumeActive) {
        silenceTimerRef.current += 1;
        // If below background noise Floor for approx 12-15 animation loops (~250ms), label as Breath Pause
        if (silenceTimerRef.current > 15) {
          isBreathingPause = true;
        }
      } else {
        silenceTimerRef.current = 0;
      }

      // 6. Calculate Vocal Tension
      const vocalTension = Math.min(
        1.0, 
        Math.max(0.0, spectralFeatures.brightness * 1.2 - spectralFeatures.warmth * 0.4)
      );

      // Assemble all characteristics to pass upwards
      const currentFeatures: AudioFeatures = {
        pitch: confidence > 0.65 ? pitch : -1,
        pitchConfidence: confidence,
        amplitude: scaledAmp,
        onset,
        timbreBright: spectralFeatures.brightness,
        timbreWarm: spectralFeatures.warmth,
        energyLow: spectralFeatures.lowEnergy,
        energyMid: spectralFeatures.midEnergy,
        energyHigh: spectralFeatures.highEnergy,
        isBreathingPause,
        vocalTension
      };

      // Pass forward to visual drawer
      if (paintActive) {
        onFeaturesUpdate(currentFeatures);
      } else {
        onFeaturesUpdate(null);
      }

      animationFrameRef.current = requestAnimationFrame(analyzeAudioFrame);
    };

    animationFrameRef.current = requestAnimationFrame(analyzeAudioFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [micActive, audioSensitivity, audioNoiseFloor, paintActive]);

  // Clean-up on dismount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return null; // Entirely hidden under-the-hood engine
};

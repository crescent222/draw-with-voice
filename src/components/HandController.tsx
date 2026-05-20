/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { HandData } from '../types';
import { checkFistGesture } from '../utils/handDetection';

interface HandControllerProps {
  onHandUpdate: (hand: HandData | null) => void;
  onRegisterStartTrigger?: (startFn: () => void) => void;
  onRegisterStopTrigger?: (stopFn: () => void) => void;
}

export const HandController: React.FC<HandControllerProps> = ({
  onHandUpdate,
  onRegisterStartTrigger,
  onRegisterStopTrigger
}) => {
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [cameraActive, setCameraActive] = useState(false);
  const [isFistActive, setIsFistActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraInstanceRef = useRef<any>(null);
  const handsInstanceRef = useRef<any>(null);
  const fistCounterRef = useRef<number>(0);

  // Programmatically hook MediaPipe global scripts
  const loadMediaPipe = () => {
    if (loadingState !== 'idle') return;
    setLoadingState('loading');

    const loadScript = (url: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${url}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = url;
        script.crossOrigin = 'anonymous';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script ${url}`));
        document.body.appendChild(script);
      });
    };

    loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js')
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'))
      .then(() => {
        if ((window as any).Hands && (window as any).Camera) {
          setLoadingState('ready');
          startTrackingCamera();
        } else {
          setLoadingState('error');
        }
      })
      .catch((err) => {
        console.error(err);
        setLoadingState('error');
      });
  };

  const startTrackingCamera = () => {
    setCameraActive(true);
  };

  const startCamera = () => {
    if (loadingState === 'idle') {
      loadMediaPipe();
    } else if (loadingState === 'ready') {
      startTrackingCamera();
    }
  };

  const stopCamera = () => {
    if (cameraInstanceRef.current) {
      cameraInstanceRef.current.stop();
      cameraInstanceRef.current = null;
    }
    if (handsInstanceRef.current) {
      handsInstanceRef.current.close();
      handsInstanceRef.current = null;
    }
    
    setCameraActive(false);
    setIsFistActive(false);
    onHandUpdate(null);
  };

  // Connect master triggers in parent App
  useEffect(() => {
    if (onRegisterStartTrigger) {
      onRegisterStartTrigger(startCamera);
    }
  }, [onRegisterStartTrigger, loadingState]);

  useEffect(() => {
    if (onRegisterStopTrigger) {
      onRegisterStopTrigger(stopCamera);
    }
  }, [onRegisterStopTrigger]);

  useEffect(() => {
    if (loadingState === 'ready' && cameraActive) {
      initializeHandTrackingEngine();
    }
  }, [loadingState, cameraActive]);

  const initializeHandTrackingEngine = () => {
    const video = videoRef.current;
    if (!video || !(window as any).Hands || !(window as any).Camera) return;

    try {
      const hands = new (window as any).Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.60
      });

      hands.onResults((results: any) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0];
          const isFistRaw = checkFistGesture(landmarks);
          
          if (isFistRaw) {
            fistCounterRef.current = Math.min(3, fistCounterRef.current + 1);
          } else {
            fistCounterRef.current = Math.max(0, fistCounterRef.current - 1);
          }
          
          const isFistStable = fistCounterRef.current >= 2;
          setIsFistActive(isFistStable);

          const currentHand: HandData = {
            present: true,
            isFist: isFistStable,
            boxSize: 1.0,
            position: { x: landmarks[9].x, y: landmarks[9].y },
            landmarks
          };
          
          onHandUpdate(currentHand);
        } else {
          fistCounterRef.current = 0;
          setIsFistActive(false);
          onHandUpdate({
            present: false,
            isFist: false,
            boxSize: 0,
            position: null,
            landmarks: null
          });
        }
      });

      handsInstanceRef.current = hands;

      const camera = new (window as any).Camera(video, {
        onFrame: async () => {
          if (videoRef.current && cameraActive) {
            await hands.send({ image: videoRef.current });
          }
        },
        width: 320,
        height: 240
      });

      camera.start()
        .then(() => {
          cameraInstanceRef.current = camera;
        })
        .catch((err: any) => {
          console.error(err);
          stopCamera();
        });

    } catch (e) {
      console.error(e);
      stopCamera();
    }
  };

  useEffect(() => {
    return () => {
      if (cameraInstanceRef.current) cameraInstanceRef.current.stop();
      if (handsInstanceRef.current) handsInstanceRef.current.close();
    };
  }, []);

  if (!cameraActive) return null;

  return (
    <div 
      id="handpose-floating-pip"
      className="absolute bottom-4 right-4 z-20 w-32 aspect-video rounded-lg overflow-hidden border border-neutral-300/60 shadow-xl bg-neutral-950/70 group"
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover scale-x-[-1]"
      />

      {isFistActive && (
        <div className="absolute inset-0 bg-red-600/40 backdrop-blur-xs flex items-center justify-center border border-red-500 text-center text-white scale-100 transition-transform">
          <span className="font-mono font-bold text-[9px] tracking-tight">✊ FIST RESET</span>
        </div>
      )}
    </div>
  );
};

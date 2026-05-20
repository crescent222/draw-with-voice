/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AudioFeatures {
  pitch: number;          // Detected pitch in Hz
  pitchConfidence: number; // Pitch confidence (0.0 to 1.0)
  amplitude: number;      // Current RMS amplitude (0.0 to 1.0)
  onset: boolean;         // True if there is a sudden beat / attack
  timbreBright: number;   // High-frequency sibilance/brightness ratio
  timbreWarm: number;     // Low-mid frequency resonance ratio
  energyLow: number;      // Low frequency energy (bass)
  energyMid: number;      // Mid frequency energy (vocal body)
  energyHigh: number;     // High frequency energy (treble)
  isBreathingPause: boolean; // True if the user is pausing/breathing
  vocalTension: number;   // Calculated emotional tension/instability of features
}

export interface HandData {
  present: boolean;
  isFist: boolean;
  boxSize: number;
  position: { x: number; y: number } | null;
  landmarks: Array<{ x: number; y: number; z: number }> | null;
}

export type ArtStyle = 'kandinsky' | 'vangogh' | 'expressionism' | 'balanced';

export interface VisualElement {
  id: string;
  type: 'swirl' | 'geometry' | 'bleed' | 'axis' | 'checker';
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  birth: number;
  lifespan: number;
  color: string;
  alpha: number;
  // Specific properties
  angle?: number;
  pulseSpeed?: number;
  geometryType?: 'circle' | 'semicircle' | 'rect' | 'triangle' | 'ring' | 'concentric' | 'crescent' | 'orbitLine' | 'rectGrid' | 'parallelHatch' | 'archedLadder' | 'hatchedTriangle' | 'intersectingPlanes' | 'scallopBowl' | 'stripeBlock' | 'boatCrescent' | 'fanningRays';
  energyResonance?: number;
  connectedTo?: string; // id of another element
  points?: Array<{ x: number; y: number }>; // For path-based strokes
}

export interface SwirlParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface ColorPalette {
  name: string;
  background: string;
  strokes: string[];
  accents: string[];
  contrast: string;
}

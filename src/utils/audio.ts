/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Autocorrelation pitch detection algorithm for live vocals.
 * This looks for repeating patterns in the time-domain signal to find the fundamental frequency (F0).
 * Highly optimized for real-time performance.
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): { pitch: number; confidence: number } {
  const size = buffer.length;
  
  // Calculate RMS (Signal power) to reject quiet noise
  let rms = 0;
  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.005) {
    return { pitch: -1, confidence: 0 }; // Too quiet
  }

  // Trim quiet head and tail (clipping boundaries for efficiency)
  let r1 = 0;
  let r2 = size - 1;
  const thres = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buffer[i]) < thres) { r1 = i; } else { break; }
  }
  for (let i = size - 1; i > size / 2; i--) {
    if (Math.abs(buffer[i]) < thres) { r2 = i; } else { break; }
  }

  const trimmed = buffer.subarray(r1, r2);
  const len = trimmed.length;
  if (len < 64) {
    return { pitch: -1, confidence: 0 };
  }

  // Autocorrelation array
  const c = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < len - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  // Find the first zero-crossing
  let d = 0;
  while (d < len - 1 && c[d] > 0) {
    d++;
  }

  // Find the maximum peak after zero-crossing
  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < len; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  if (maxPos !== -1) {
    // Parabolic interpolation for pitch precision refine
    let x1 = c[maxPos - 1] || 0;
    const x2 = c[maxPos];
    let x3 = c[maxPos + 1] || 0;
    
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    
    let refinedPos = maxPos;
    if (a !== 0) {
      refinedPos = maxPos - b / (2 * a);
    }
    
    const frequency = sampleRate / refinedPos;
    
    // Vocal pitch filter: bounds human voice singing (approx. 50Hz to 1200Hz)
    if (frequency > 50 && frequency < 1200) {
      const confidence = Math.min(1.0, maxVal / c[0]);
      return { pitch: frequency, confidence };
    }
  }

  return { pitch: -1, confidence: 0 };
}

/**
 * Calculates spectral centroid and sub-band split ratios
 */
export function analyseSpectrum(freqData: Uint8Array, sampleRate: number): {
  brightness: number;  // Spectral Centroid normalized
  warmth: number;      // Ratio of mid-low vocal power
  lowEnergy: number;   // Bass level
  midEnergy: number;   // Main voice power
  highEnergy: number;  // Airy breath level
} {
  const bins = freqData.length;
  if (bins === 0) {
    return { brightness: 0, warmth: 0, lowEnergy: 0, midEnergy: 0, highEnergy: 0 };
  }

  const binWidth = (sampleRate / 2) / bins;

  let totalSum = 0;
  let weightedSum = 0;
  
  let lowPower = 0;
  let midPower = 0;
  let highPower = 0;

  for (let i = 0; i < bins; i++) {
    const val = freqData[i] / 255.0; // scale 0-1
    totalSum += val;
    weightedSum += val * (i * binWidth);

    const freq = i * binWidth;
    if (freq < 250) {
      lowPower += val;
    } else if (freq < 1500) {
      midPower += val;
    } else {
      highPower += val;
    }
  }

  const averageVal = totalSum / bins;
  const rawCentroid = totalSum > 0 ? (weightedSum / totalSum) : 0;
  
  // Normalise spectral centroid to a neat 0.0 - 1.0 based on 0-6000Hz voice content
  const brightness = Math.min(1.0, rawCentroid / 6000);

  // Ratio of mid vocal energy relative to bright high end
  const vocalPower = midPower + lowPower + highPower;
  const warmth = vocalPower > 0 ? (midPower / vocalPower) : 0;

  return {
    brightness,
    warmth,
    lowEnergy: Math.min(1.0, lowPower / (bins * 0.15)),
    midEnergy: Math.min(1.0, midPower / (bins * 0.5)),
    highEnergy: Math.min(1.0, highPower / (bins * 0.35)),
  };
}

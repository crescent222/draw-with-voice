/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HandData } from '../types';

interface Landmark {
  x: number;
  y: number;
  z: number;
}

/**
 * Calculates Euclidean distance between two 3D vectors
 */
function distance3D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Analyses MediaPipe Hand landmarks to determine if the hand is in a closed fist state.
 * Implements a relative distance ratio algorithm:
 * 1. Computes the palm scale (distance between Wrist [0] and Middle MCP [9])
 * 2. Measures distance of each finger tip (Index [8], Middle [12], Ring [16], Pinky [20]) to the base MCPs or Wrist.
 * 3. If fingertip-to-wrist distances are compressed compared to open hand profiles, isFist evaluates to true.
 */
export function checkFistGesture(landmarks: Landmark[]): boolean {
  if (!landmarks || landmarks.length < 21) return false;

  const wrist = landmarks[0];
  const indexMCP = landmarks[5];
  const middleMCP = landmarks[9];
  const ringMCP = landmarks[13];
  const pinkyMCP = landmarks[17];

  // Palm reference scale
  const palmScale = distance3D(wrist, middleMCP);
  if (palmScale < 0.0001) return false;

  // Fingertips
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  // Distances from tips to wrist
  const dIndex = distance3D(indexTip, wrist);
  const dMiddle = distance3D(middleTip, wrist);
  const dRing = distance3D(ringTip, wrist);
  const dPinky = distance3D(pinkyTip, wrist);

  // Distances of MCP bases to wrist
  const dIndexBase = distance3D(indexMCP, wrist);
  const dMiddleBase = distance3D(middleMCP, wrist);
  const dRingBase = distance3D(ringMCP, wrist);
  const dPinkyBase = distance3D(pinkyMCP, wrist);

  // In an open hand, fingertip-to-wrist is significantly larger than MCP-to-wrist
  // In a closed fist, fingertips curl in and their distance to the wrist is very close to or less than MCP-to-wrist distances.
  
  // 1. Core Relative Fold Ratio per principal finger
  // For each finger (Index, Middle, Ring, Pinky), we look at MCP joint, PIP joint, DIP joint, and Tip.
  // We compare the straight line tip-to-MCP distance against the combined lengths of the finger segments.
  // When a finger curls into a fist, the tip-to-MCP distance compresses to less than 62% of physical length.
  const checkFingerFolded = (mcpIdx: number, pipIdx: number, dipIdx: number, tipIdx: number): boolean => {
    const mcp = landmarks[mcpIdx];
    const pip = landmarks[pipIdx];
    const dip = landmarks[dipIdx];
    const tip = landmarks[tipIdx];

    const segmentSum = distance3D(mcp, pip) + distance3D(pip, dip) + distance3D(dip, tip);
    const tipToMCP = distance3D(tip, mcp);

    if (segmentSum < 0.001) return false;
    return (tipToMCP / segmentSum) < 0.62;
  };

  const indexFolded = checkFingerFolded(5, 6, 7, 8);
  const middleFolded = checkFingerFolded(9, 10, 11, 12);
  const ringFolded = checkFingerFolded(13, 14, 15, 16);
  const pinkyFolded = checkFingerFolded(17, 18, 19, 20);

  // If at least 3 of 4 principal fingers are tightly folded, classify as a fist
  let foldedCount = 0;
  if (indexFolded) foldedCount++;
  if (middleFolded) foldedCount++;
  if (ringFolded) foldedCount++;
  if (pinkyFolded) foldedCount++;

  // Fallback: Wrist-based check from original logic to retain multi-angle redundancy
  const foldedIndexWrist = dIndex < dIndexBase * 1.12;
  const foldedMiddleWrist = dMiddle < dMiddleBase * 1.12;
  const foldedRingWrist = dRing < dRingBase * 1.12;
  const foldedPinkyWrist = dPinky < dPinkyBase * 1.12;

  let wristFoldedCount = 0;
  if (foldedIndexWrist) wristFoldedCount++;
  if (foldedMiddleWrist) wristFoldedCount++;
  if (foldedRingWrist) wristFoldedCount++;
  if (foldedPinkyWrist) wristFoldedCount++;

  return foldedCount >= 3 || wristFoldedCount >= 3;
}

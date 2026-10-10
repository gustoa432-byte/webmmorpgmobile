/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Core } from '../core/Core';

interface VirtualJoystickProps {
  core: Core;
}

type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Maps physical key codes, standard keys, Russian Cyrillic, and AZERTY layouts to cardinal directions.
 */
function mapKeyToDirection(e: KeyboardEvent): Direction | null {
  const code = e.code;
  const key = (e.key || '').toLowerCase();

  // UP: KeyW, ArrowUp, 'w', 'ц' (Russian Cyrillic on W), 'z' (AZERTY)
  if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'ц' || key === 'arrowup' || key === 'z') {
    return 'up';
  }
  // DOWN: KeyS, ArrowDown, 's', 'ы' (Russian Cyrillic on S)
  if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'ы' || key === 'arrowdown') {
    return 'down';
  }
  // LEFT: KeyA, ArrowLeft, 'a', 'ф' (Russian Cyrillic on A), 'q' (AZERTY)
  if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'ф' || key === 'arrowleft' || key === 'q') {
    return 'left';
  }
  // RIGHT: KeyD, ArrowRight, 'd', 'в' (Russian Cyrillic on D)
  if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'в' || key === 'arrowright') {
    return 'right';
  }

  return null;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ core }) => {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isTouchActive, setIsTouchActive] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const touchVectorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Set of actively pressed keyboard directions
  const activeKeysRef = useRef<Set<Direction>>(new Set());

  // Function to send current directional movement to the core
  const sendMoveCommand = useCallback(
    (vec: { x: number; y: number } | null) => {
      const pId = core.getPlayerId();
      if (pId <= 0) return;

      core.enqueueCommand({
        type: 'Move',
        entityId: pId,
        direction: vec ? { ...vec } : null
      });
    },
    [core]
  );

  // Master continuous movement interval (handles both keyboard and touch smoothly at 20 TPS)
  useEffect(() => {
    const interval = window.setInterval(() => {
      // 1. Pointer joystick has priority if actively dragged
      if (pointerIdRef.current !== null) {
        if (touchVectorRef.current.x !== 0 || touchVectorRef.current.y !== 0) {
          sendMoveCommand(touchVectorRef.current);
        }
        return;
      }

      // 2. Keyboard directions
      const keys = activeKeysRef.current;
      if (keys.size > 0) {
        let dx = 0;
        let dy = 0;
        if (keys.has('up')) dy -= 1;
        if (keys.has('down')) dy += 1;
        if (keys.has('left')) dx -= 1;
        if (keys.has('right')) dx += 1;

        if (dx !== 0 || dy !== 0) {
          const len = Math.hypot(dx, dy);
          const nx = dx / len;
          const ny = dy / len;
          sendMoveCommand({ x: nx, y: ny });
          // Visually tilt the virtual joystick knob for instant tactile feedback
          const maxRadius = 28;
          setKnobPos({ x: nx * maxRadius, y: ny * maxRadius });
        }
      }
    }, 45);

    return () => clearInterval(interval);
  }, [sendMoveCommand]);

  // Keyboard event listeners (Global window + document with Cyrillic & WASD support)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const dir = mapKeyToDirection(e);
      if (!dir) return;

      // Prevent scrolling page with arrow keys or space
      if (e.code.startsWith('Arrow')) {
        e.preventDefault();
      }

      activeKeysRef.current.add(dir);

      // Immediately trigger first step without waiting for interval delay
      let dx = 0;
      let dy = 0;
      if (activeKeysRef.current.has('up')) dy -= 1;
      if (activeKeysRef.current.has('down')) dy += 1;
      if (activeKeysRef.current.has('left')) dx -= 1;
      if (activeKeysRef.current.has('right')) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        const nx = dx / len;
        const ny = dy / len;
        sendMoveCommand({ x: nx, y: ny });
        setKnobPos({ x: nx * 28, y: ny * 28 });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const dir = mapKeyToDirection(e);
      if (!dir) return;

      activeKeysRef.current.delete(dir);

      if (activeKeysRef.current.size === 0) {
        sendMoveCommand(null);
        setKnobPos({ x: 0, y: 0 });
      } else {
        let dx = 0;
        let dy = 0;
        if (activeKeysRef.current.has('up')) dy -= 1;
        if (activeKeysRef.current.has('down')) dy += 1;
        if (activeKeysRef.current.has('left')) dx -= 1;
        if (activeKeysRef.current.has('right')) dx += 1;
        if (dx !== 0 || dy !== 0) {
          const len = Math.hypot(dx, dy);
          const nx = dx / len;
          const ny = dy / len;
          sendMoveCommand({ x: nx, y: ny });
          setKnobPos({ x: nx * 28, y: ny * 28 });
        } else {
          sendMoveCommand(null);
          setKnobPos({ x: 0, y: 0 });
        }
      }
    };

    const handleBlur = () => {
      if (activeKeysRef.current.size > 0) {
        activeKeysRef.current.clear();
        sendMoveCommand(null);
        setKnobPos({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [sendMoveCommand]);

  // Pointer joystick helper
  const updateVectorFromPointer = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const maxDist = rect.width / 2 - 10;
    let dx = clientX - centerX;
    let dy = clientY - centerY;

    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    setKnobPos({ x: dx, y: dy });

    const normalizedDist = Math.min(1, dist / maxDist);
    if (normalizedDist > 0.12) {
      const vec = {
        x: dx / maxDist,
        y: dy / maxDist
      };
      touchVectorRef.current = vec;
      sendMoveCommand(vec);
    } else {
      touchVectorRef.current = { x: 0, y: 0 };
      sendMoveCommand(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // fallback
    }
    setIsTouchActive(true);
    updateVectorFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (pointerIdRef.current === e.pointerId) {
      updateVectorFromPointer(e.clientX, e.clientY);
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (pointerIdRef.current === e.pointerId) {
      pointerIdRef.current = null;
      setIsTouchActive(false);
      setKnobPos({ x: 0, y: 0 });
      touchVectorRef.current = { x: 0, y: 0 };
      sendMoveCommand(null);
    }
  };

  const isJoystickPushed = isTouchActive || activeKeysRef.current.size > 0;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className="relative w-32 h-32 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center touch-none select-none pointer-events-auto shadow-2xl"
    >
      {/* Background crosshair */}
      <div className="absolute w-full h-px bg-slate-700/40" />
      <div className="absolute h-full w-px bg-slate-700/40" />

      {/* Direction indicators */}
      <span className="absolute top-1 text-[9px] font-mono text-slate-500 font-bold">W</span>
      <span className="absolute bottom-1 text-[9px] font-mono text-slate-500 font-bold">S</span>
      <span className="absolute left-1.5 text-[9px] font-mono text-slate-500 font-bold">A</span>
      <span className="absolute right-1.5 text-[9px] font-mono text-slate-500 font-bold">D</span>

      {/* Joystick Handle / Knob */}
      <div
        style={{
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`
        }}
        className={`w-12 h-12 rounded-full border-2 transition-transform duration-75 flex items-center justify-center shadow-lg ${
          isJoystickPushed
            ? 'bg-amber-500/90 border-amber-300 scale-105'
            : 'bg-slate-700 border-slate-500'
        }`}
      >
        <div className="w-4 h-4 rounded-full bg-white/40" />
      </div>
    </div>
  );
};

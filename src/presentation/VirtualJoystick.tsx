/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { Core } from '../core/Core';

interface VirtualJoystickProps {
  core: Core;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ core }) => {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchIdRef = useRef<number | null>(null);
  const moveIntervalRef = useRef<number | null>(null);
  const currentVectorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const playerId = core.getPlayerId();

  // Desktop keyboard WASD / Arrow keys support
  useEffect(() => {
    const keysDown = new Set<string>();

    const updateDirectionFromKeys = () => {
      let dx = 0;
      let dy = 0;
      if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) dy -= 1;
      if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) dy += 1;
      if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) dx -= 1;
      if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        core.enqueueCommand({
          type: 'Move',
          entityId: playerId,
          direction: { x: dx / len, y: dy / len }
        });
      } else {
        core.enqueueCommand({
          type: 'Move',
          entityId: playerId,
          direction: { x: 0, y: 0 }
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        keysDown.add(e.code);
        updateDirectionFromKeys();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (keysDown.has(e.code)) {
        keysDown.delete(e.code);
        updateDirectionFromKeys();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [core, playerId]);

  // Touch joystick continuous loop
  useEffect(() => {
    if (isActive) {
      moveIntervalRef.current = window.setInterval(() => {
        if (currentVectorRef.current.x !== 0 || currentVectorRef.current.y !== 0) {
          core.enqueueCommand({
            type: 'Move',
            entityId: playerId,
            direction: { ...currentVectorRef.current }
          });
        }
      }, 50);
    } else {
      if (moveIntervalRef.current) {
        clearInterval(moveIntervalRef.current);
        moveIntervalRef.current = null;
      }
    }

    return () => {
      if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
    };
  }, [isActive, core, playerId]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setIsActive(true);
    handleTouchMove(e);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchIdRef.current === null || !containerRef.current) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const maxDist = rect.width / 2 - 10;
        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;

        const dist = Math.hypot(dx, dy);
        if (dist > maxDist) {
          dx = (dx / dist) * maxDist;
          dy = (dy / dist) * maxDist;
        }

        setKnobPos({ x: dx, y: dy });

        const normalizedDist = Math.min(1, dist / maxDist);
        if (normalizedDist > 0.1) {
          currentVectorRef.current = {
            x: dx / maxDist,
            y: dy / maxDist
          };
        } else {
          currentVectorRef.current = { x: 0, y: 0 };
        }
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setIsActive(false);
        setKnobPos({ x: 0, y: 0 });
        currentVectorRef.current = { x: 0, y: 0 };
        core.enqueueCommand({
          type: 'Move',
          entityId: playerId,
          direction: { x: 0, y: 0 }
        });
        break;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="relative w-28 h-28 rounded-full bg-slate-900/60 border-2 border-slate-700/60 backdrop-blur-sm flex items-center justify-center touch-none select-none pointer-events-auto"
    >
      {/* Background crosshair */}
      <div className="absolute w-full h-px bg-slate-700/40" />
      <div className="absolute h-full w-px bg-slate-700/40" />

      {/* Joystick Handle / Knob */}
      <div
        style={{
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`
        }}
        className={`w-12 h-12 rounded-full border-2 transition-transform duration-75 flex items-center justify-center shadow-lg ${
          isActive
            ? 'bg-amber-500/80 border-amber-300 scale-105'
            : 'bg-slate-700/80 border-slate-500'
        }`}
      >
        <div className="w-4 h-4 rounded-full bg-white/40" />
      </div>
    </div>
  );
};

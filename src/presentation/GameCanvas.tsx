/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { Core } from '../core/Core';
import { EntityId } from '../core/types';
import { CoreEvent } from '../core/events/EventBus';

interface GameCanvasProps {
  core: Core;
  showGrid: boolean;
  onSelectEntity: (id: EntityId | null) => void;
  selectedEntityId: EntityId | null;
  isPaused?: boolean;
  hardCamera?: boolean;
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  isCrit: boolean;
  age: number; // 0 to 1
}

interface SkillVfx {
  id: number;
  type: string;
  x: number;
  y: number;
  radius: number;
  age: number;
  maxAge: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  core,
  showGrid,
  onSelectEntity,
  selectedEntityId,
  isPaused = false,
  hardCamera = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const skillVfxRef = useRef<SkillVfx[]>([]);
  const nextFxId = useRef<number>(1);

  // Keep a ref to isPaused and hardCamera to avoid stale callbacks
  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
    if (!isPaused) {
      lastTimeRef.current = performance.now();
    }
  }, [isPaused]);

  const hardCameraRef = useRef(hardCamera);
  useEffect(() => {
    hardCameraRef.current = hardCamera;
  }, [hardCamera]);

  // Camera offset in world units
  const cameraRef = useRef<{ x: number; y: number }>({ x: 24, y: 24 });
  const zoom = 32; // Pixels per world meter

  // Listen to Core events for VFX and floating damage numbers
  useEffect(() => {
    const unsubscribe = core.eventBus.subscribe('*', (event: CoreEvent) => {
      if (event.type === 'OnEntityDamaged') {
        floatingTextsRef.current.push({
          id: nextFxId.current++,
          text: event.isCrit ? `КРИТ ${event.damage}!` : `${event.damage}`,
          x: event.position.x + (Math.random() - 0.5) * 0.4,
          y: event.position.y - 0.5,
          color: event.isCrit ? '#38bdf8' : event.sourceId === core.getPlayerId() ? '#facc15' : '#ef4444',
          isCrit: event.isCrit,
          age: 0
        });
      } else if (event.type === 'OnSkillUsed') {
        skillVfxRef.current.push({
          id: nextFxId.current++,
          type: event.skillId,
          x: event.targetPos?.x ?? 24,
          y: event.targetPos?.y ?? 24,
          radius: event.aoeRadius || 2.5,
          age: 0,
          maxAge: 0.5
        });
      } else if (event.type === 'OnLevelUp') {
        floatingTextsRef.current.push({
          id: nextFxId.current++,
          text: `УРОВЕНЬ ПОВЫШЕН! (${event.newLevel})`,
          x: 24,
          y: 23,
          color: '#eab308',
          isCrit: true,
          age: 0
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [core]);

  // Main Render Loop with interpolation
  const renderFrame = useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = now;

    // Smoothly step simulation & retrieve interpolation factor alpha
    // When paused, simulation does NOT step (core.step(dt) is not called)
    let alpha = 1.0;
    if (!isPausedRef.current) {
      alpha = core.step(dt);
    }

    // Update camera smoothly following player
    const playerId = core.getPlayerId();
    const playerTransform = core.entities.getComponent(playerId, 'Transform');
    if (playerTransform) {
      const px = playerTransform.previousPosition.x + (playerTransform.position.x - playerTransform.previousPosition.x) * alpha;
      const py = playerTransform.previousPosition.y + (playerTransform.position.y - playerTransform.previousPosition.y) * alpha;
      const smoothing = hardCameraRef.current ? 1.0 : 0.30;
      cameraRef.current.x += (px - cameraRef.current.x) * smoothing;
      cameraRef.current.y += (py - cameraRef.current.y) * smoothing;
    }

    const width = canvas.width;
    const height = canvas.height;
    const camX = cameraRef.current.x;
    const camY = cameraRef.current.y;

    // World to Screen coordinate conversion (isometric-leaning top-down)
    const worldToScreen = (wx: number, wy: number) => {
      return {
        sx: width / 2 + (wx - camX) * zoom,
        sy: height / 2 + (wy - camY) * zoom
      };
    };

    // 1. Draw Background / Terrain (Lorencia cobblestones & grass)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Draw Map Grounds
    const mapConf = core.configs.getMap();
    const mapMin = worldToScreen(0, 0);
    const mapMax = worldToScreen(mapConf.width, mapConf.height);

    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(mapMin.sx, mapMin.sy, mapMax.sx - mapMin.sx, mapMax.sy - mapMin.sy);

    // Tile pattern grid lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    const startTileX = Math.max(0, Math.floor(camX - width / (2 * zoom)));
    const endTileX = Math.min(mapConf.width, Math.ceil(camX + width / (2 * zoom)));
    const startTileY = Math.max(0, Math.floor(camY - height / (2 * zoom)));
    const endTileY = Math.min(mapConf.height, Math.ceil(camY + height / (2 * zoom)));

    for (let x = startTileX; x <= endTileX; x++) {
      const p1 = worldToScreen(x, startTileY);
      const p2 = worldToScreen(x, endTileY);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();
    }
    for (let y = startTileY; y <= endTileY; y++) {
      const p1 = worldToScreen(startTileX, y);
      const p2 = worldToScreen(endTileX, y);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();
    }

    // Draw Safe Zone (Town square centered at 24, 24)
    const townCenter = { x: 24, y: 24 };
    const fountainScreen = worldToScreen(townCenter.x, townCenter.y);
    const safeRadiusPx = mapConf.safeZoneRadius * zoom;

    // Outer safe aura
    const auraGrad = ctx.createRadialGradient(
      fountainScreen.sx,
      fountainScreen.sy,
      safeRadiusPx * 0.4,
      fountainScreen.sx,
      fountainScreen.sy,
      safeRadiusPx
    );
    auraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
    auraGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0.05)');
    auraGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(fountainScreen.sx, fountainScreen.sy, safeRadiusPx, 0, Math.PI * 2);
    ctx.fill();

    // Safe zone border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(fountainScreen.sx, fountainScreen.sy, safeRadiusPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Central Town Fountain at (24, 24)
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(fountainScreen.sx, fountainScreen.sy, 1.8 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Central fountain water sparkle
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(fountainScreen.sx, fountainScreen.sy, 0.6 * zoom, 0, Math.PI * 2);
    ctx.fill();

    // Other Obstacles (skip obs 0 which is the central fountain)
    for (let i = 1; i < mapConf.obstacles.length; i++) {
      const obs = mapConf.obstacles[i];
      const obsScreen = worldToScreen(obs.x, obs.y);
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(obsScreen.sx, obsScreen.sy, obs.radius * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Walkability Grid visualization (if toggled)
    if (showGrid) {
      for (let gy = startTileY; gy < endTileY; gy++) {
        for (let gx = startTileX; gx < endTileX; gx++) {
          const tile = core.physics.grid.getTile(gx, gy);
          if (tile === 1) { // BLOCKED
            const p = worldToScreen(gx, gy);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
            ctx.fillRect(p.sx, p.sy, zoom, zoom);
          } else if (tile === 2) { // SAFE
            const p = worldToScreen(gx, gy);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
            ctx.fillRect(p.sx, p.sy, zoom, zoom);
          }
        }
      }
    }

    // 2. Draw Items on Ground
    const itemEntities = core.entities.getEntitiesByTag('Item');
    for (const itemId of itemEntities) {
      const t = core.entities.getComponent(itemId, 'Transform');
      const drop = core.entities.getComponent(itemId, 'ItemDrop');
      if (!t || !drop) continue;

      const p = worldToScreen(t.position.x, t.position.y);

      // Glow effect based on item type
      const isJewel = drop.templateId.startsWith('jewel');
      const isZen = drop.templateId === 'zen';
      const glowColor = isJewel ? '#38bdf8' : isZen ? '#fbbf24' : '#f87171';

      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = isJewel ? 16 : 8;

      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, isJewel ? 6 : 5, 0, Math.PI * 2);
      ctx.fill();

      // Item Name Banner (Mu Online signature golden/white brackets)
      ctx.font = 'bold 11px sans-serif';
      const label = isZen ? `Zen (${drop.zenAmount})` : drop.itemName;
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(p.sx - textWidth / 2 - 4, p.sy - 22, textWidth + 8, 16);

      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.sx - textWidth / 2 - 4, p.sy - 22, textWidth + 8, 16);

      ctx.fillStyle = isJewel ? '#7dd3fc' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(label, p.sx, p.sy - 10);
      ctx.restore();
    }

    // 3. Draw Monsters & Player
    const allEntities = core.entities.getAllEntities();

    // Sort entities by Y position for proper isometric depth sorting
    const renderableEntities = allEntities
      .map(id => {
        const trans = core.entities.getComponent(id, 'Transform');
        return { id, trans };
      })
      .filter((e): e is { id: number; trans: NonNullable<typeof e.trans> } => e.trans !== null)
      .sort((a, b) => a.trans.position.y - b.trans.position.y);

    for (const { id } of renderableEntities) {
      const trans = core.entities.getComponent(id, 'Transform')!;
      const health = core.entities.getComponent(id, 'Health');
      const collider = core.entities.getComponent(id, 'Collider');
      const combat = core.entities.getComponent(id, 'Combat');
      const isPlayer = core.entities.hasTag(id, 'Player');
      const isMonster = core.entities.hasTag(id, 'Monster');

      // Interpolate position
      const renderX = trans.previousPosition.x + (trans.position.x - trans.previousPosition.x) * alpha;
      const renderY = trans.previousPosition.y + (trans.position.y - trans.previousPosition.y) * alpha;
      const screenPos = worldToScreen(renderX, renderY);

      if (isPlayer) {
        // --- DRAW DARK KNIGHT ---
        const radiusPx = (collider?.radius ?? 0.5) * zoom;

        // Selection / Target Reticle if selected
        if (selectedEntityId === id) {
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(screenPos.sx, screenPos.sy, radiusPx * 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(screenPos.sx, screenPos.sy + 4, radiusPx * 1.1, radiusPx * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dark Knight Armor Body (Metallic Gold/Red Dragon Set)
        ctx.fillStyle = '#dc2626'; // Dragon Red
        ctx.beginPath();
        ctx.arc(screenPos.sx, screenPos.sy, radiusPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fbbf24'; // Gold Trim
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Facing direction indicator / Sword
        const facing = trans.rotation;
        const swordLen = radiusPx * 1.4;
        const swordTipX = screenPos.sx + Math.cos(facing) * swordLen;
        const swordTipY = screenPos.sy + Math.sin(facing) * swordLen;

        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screenPos.sx, screenPos.sy);
        ctx.lineTo(swordTipX, swordTipY);
        ctx.stroke();

        // Attack Swing Trail
        if (combat?.isAttacking) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(screenPos.sx, screenPos.sy, radiusPx * 1.6, facing - 0.7, facing + 0.7);
          ctx.stroke();
        }

        // Player Name & Level Badge
        const playerComp = core.entities.getComponent(id, 'Player');
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`Темный Рыцарь (Ур.${playerComp?.level ?? 1})`, screenPos.sx, screenPos.sy - radiusPx - 16);

        // Player Health Bar
        if (health) {
          const barW = 44;
          const barH = 5;
          const hpRatio = Math.max(0, health.currentHp / health.maxHp);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(screenPos.sx - barW / 2, screenPos.sy - radiusPx - 10, barW, barH);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(screenPos.sx - barW / 2, screenPos.sy - radiusPx - 10, barW * hpRatio, barH);
        }
      } else if (isMonster && health && !health.isDead) {
        // --- DRAW MONSTER ---
        const ai = core.entities.getComponent(id, 'AI');
        const monsterConf = ai ? core.configs.getMonster(ai.monsterTemplateId) : undefined;
        const radiusPx = (collider?.radius ?? 0.5) * zoom;
        const mColor = monsterConf?.color ?? '#9333ea';

        // Aggro line towards player if chasing/attacking
        if (ai?.state === 'chase' || ai?.state === 'attack') {
          const targetTrans = ai.targetEntityId ? core.entities.getComponent(ai.targetEntityId, 'Transform') : null;
          if (targetTrans) {
            const targetPos = worldToScreen(targetTrans.position.x, targetTrans.position.y);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(screenPos.sx, screenPos.sy);
            ctx.lineTo(targetPos.sx, targetPos.sy);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // Selection Reticle & Arrow Marker if targeted or clicked
        const playerCombat = core.entities.getComponent(core.getPlayerId(), 'Combat');
        const isTargeted = selectedEntityId === id || playerCombat?.targetEntityId === id;
        if (isTargeted) {
          // Pulsing target circle
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(screenPos.sx, screenPos.sy, radiusPx * 1.5, 0, Math.PI * 2);
          ctx.stroke();

          // Classic Mu Online Red Target Arrow above monster
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(screenPos.sx, screenPos.sy - radiusPx - 20);
          ctx.lineTo(screenPos.sx - 6, screenPos.sy - radiusPx - 28);
          ctx.lineTo(screenPos.sx + 6, screenPos.sy - radiusPx - 28);
          ctx.closePath();
          ctx.fill();
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(screenPos.sx, screenPos.sy + 3, radiusPx * 1.1, radiusPx * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Monster Body
        ctx.fillStyle = mColor;
        ctx.beginPath();
        ctx.arc(screenPos.sx, screenPos.sy, radiusPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Monster Name
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`${monsterConf?.name ?? 'Монстр'} Ур.${monsterConf?.level ?? 1}`, screenPos.sx, screenPos.sy - radiusPx - 12);

        // Monster HP Bar
        const barW = 34;
        const barH = 4;
        const hpRatio = Math.max(0, health.currentHp / health.maxHp);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(screenPos.sx - barW / 2, screenPos.sy - radiusPx - 7, barW, barH);
        ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.2 ? '#eab308' : '#ef4444';
        ctx.fillRect(screenPos.sx - barW / 2, screenPos.sy - radiusPx - 7, barW * hpRatio, barH);
      }
    }

    // 4. Draw Active Skill VFX
    for (let i = skillVfxRef.current.length - 1; i >= 0; i--) {
      const vfx = skillVfxRef.current[i];
      if (!isPausedRef.current) {
        vfx.age += dt;
      }

      const progress = vfx.age / vfx.maxAge;
      if (progress >= 1) {
        skillVfxRef.current.splice(i, 1);
        continue;
      }

      const screen = worldToScreen(vfx.x, vfx.y);

      if (vfx.type === 'twisting_slash') {
        // Iconic 360 whirlwind blade cyclone!
        ctx.save();
        ctx.strokeStyle = `rgba(56, 189, 248, ${1 - progress})`;
        ctx.lineWidth = 4 * (1 - progress * 0.5);
        ctx.beginPath();
        ctx.arc(screen.sx, screen.sy, vfx.radius * zoom * (0.4 + progress * 0.6), progress * 8, progress * 8 + Math.PI * 1.5);
        ctx.stroke();

        ctx.strokeStyle = `rgba(250, 204, 21, ${1 - progress})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screen.sx, screen.sy, vfx.radius * zoom * (0.2 + progress * 0.8), -progress * 6, -progress * 6 + Math.PI);
        ctx.stroke();
        ctx.restore();
      } else if (vfx.type === 'cyclone') {
        // Wind cyclone trail
        ctx.save();
        ctx.strokeStyle = `rgba(34, 197, 94, ${1 - progress})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screen.sx, screen.sy, vfx.radius * zoom * progress, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Draw Floating Damage & Combat Numbers
    for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
      const item = floatingTextsRef.current[i];
      if (!isPausedRef.current) {
        item.age += dt * 1.2;
      }

      if (item.age >= 1) {
        floatingTextsRef.current.splice(i, 1);
        continue;
      }

      const screen = worldToScreen(item.x, item.y - item.age * 1.2);
      ctx.save();
      ctx.globalAlpha = 1 - item.age * 0.8;
      ctx.font = item.isCrit ? 'bold 15px sans-serif' : 'bold 12px sans-serif';
      ctx.textAlign = 'center';

      // Outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.strokeText(item.text, screen.sx, screen.sy);

      // Fill
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, screen.sx, screen.sy);
      ctx.restore();
    }

    ctx.restore();

    // Schedule next frame
    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, [core, showGrid, selectedEntityId]);

  // Canvas size and resize handling
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    animFrameRef.current = requestAnimationFrame(renderFrame);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [renderFrame]);

  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTapTimeRef = useRef<number>(0);

  // Click & Pointer Tap Handling (Single Tap & Double Tap for Mobile)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reject long swipes / drags (fixed camera)
    const moveDist = Math.hypot(
      e.clientX - pointerDownPosRef.current.x,
      e.clientY - pointerDownPosRef.current.y
    );
    if (moveDist > 15) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const camX = cameraRef.current.x;
    const camY = cameraRef.current.y;

    const worldX = camX + (mouseX - canvas.width / 2) / zoom;
    const worldY = camY + (mouseY - canvas.height / 2) / zoom;

    const playerId = core.getPlayerId();
    const now = performance.now();

    // Check for Double-Tap (< 380ms within ~35px) -> Action: Pickup item
    const tapDist = Math.hypot(
      e.clientX - lastTapPosRef.current.x,
      e.clientY - lastTapPosRef.current.y
    );
    const isDoubleTap = (now - lastTapTimeRef.current < 380) && (tapDist < 35);

    if (isDoubleTap) {
      lastTapTimeRef.current = 0; // Consume double tap

      // Find dropped items in world
      const items = core.entities.getEntitiesByTag('Item');
      let targetItemId: EntityId | undefined;
      let closestItemDist = 4.0;

      for (const itId of items) {
        const trans = core.entities.getComponent(itId, 'Transform');
        if (!trans) continue;
        const d = Math.hypot(trans.position.x - worldX, trans.position.y - worldY);
        if (d < closestItemDist) {
          closestItemDist = d;
          targetItemId = itId;
        }
      }

      // Enqueue pickup command
      core.enqueueCommand({
        type: 'Pickup',
        entityId: playerId,
        targetItemId
      });

      return;
    }

    // Register single tap
    lastTapTimeRef.current = now;
    lastTapPosRef.current = { x: e.clientX, y: e.clientY };

    // 1. Single Tap on Monster / NPC: Select target -> approach -> auto-attack!
    const monsters = core.entities.getEntitiesByTag('Monster');
    let clickedMonsterId: EntityId | null = null;
    let closestMonsterDist = 1.2; // Generous tap target for mobile touch

    for (const mId of monsters) {
      const trans = core.entities.getComponent(mId, 'Transform');
      const health = core.entities.getComponent(mId, 'Health');
      if (!trans || health?.isDead) continue;

      const dist = Math.hypot(trans.position.x - worldX, trans.position.y - worldY);
      if (dist < closestMonsterDist) {
        closestMonsterDist = dist;
        clickedMonsterId = mId;
      }
    }

    if (clickedMonsterId !== null) {
      onSelectEntity(clickedMonsterId);
      core.enqueueCommand({
        type: 'SetTarget',
        entityId: playerId,
        targetEntityId: clickedMonsterId
      });
      return;
    }

    // 2. Single Tap on Ground Item: Pickup
    const items = core.entities.getEntitiesByTag('Item');
    for (const itId of items) {
      const trans = core.entities.getComponent(itId, 'Transform');
      if (!trans) continue;
      const dist = Math.hypot(trans.position.x - worldX, trans.position.y - worldY);
      if (dist <= 1.2) {
        core.enqueueCommand({
          type: 'Pickup',
          entityId: playerId,
          targetItemId: itId
        });
        return;
      }
    }

    // 3. Single Tap on empty ground: deselect or point-and-click move
    onSelectEntity(null);
    core.enqueueCommand({
      type: 'SetTarget',
      entityId: playerId,
      targetEntityId: null
    });
    core.enqueueCommand({
      type: 'Move',
      entityId: playerId,
      targetPos: { x: worldX, y: worldY }
    });
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerUp={e => {
          handlePointerUp(e);
          canvasRef.current?.focus();
        }}
        className="w-full h-full block cursor-crosshair touch-none focus:outline-none"
      />
    </div>
  );
};

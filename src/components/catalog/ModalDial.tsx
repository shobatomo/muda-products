"use client";

import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { DialAudio } from "@/lib/dial-audio";

// The existing MudaDial motion is carried over here so HERO code remains untouched.
const ROTATION_SENSITIVITY = 0.0028;
const FRICTION = 15;
const ROTATION_DAMPING = 12;
const RATCHET_STEP = Math.PI / 60;
const RATCHET_SHARPNESS = 15;
const VIBRATION_DAMPING = 25;
const VIBRATION_SPEED = 90;
const MAX_ANIMATION_DELTA = 1 / 30;
const GESTURE_THRESHOLD = 6;

function applyRatchet(angle: number) {
    const stepIndex = Math.floor(angle / RATCHET_STEP);
    const stepStart = stepIndex * RATCHET_STEP;
    const progress = (angle - stepStart) / RATCHET_STEP;
    const eased = progress < 0.5
        ? 0.5 * (progress * 2) ** RATCHET_SHARPNESS
        : 1 - 0.5 * ((1 - progress) * 2) ** RATCHET_SHARPNESS;
    return stepStart + eased * RATCHET_STEP;
}

export function ModalDial({ audio }: { audio: DialAudio | null }) {
    const gltf = useGLTF("/models/muda-dial-optimized.glb");
    const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
    const canvas = useThree((state) => state.gl.domElement);
    const group = useRef<THREE.Group>(null);
    const dial = useRef<THREE.Object3D | null>(null);
    const motion = useRef({ pointer: null as number | null, startX: 0, startY: 0, previousX: 0, lastTime: 0, axis: null as "horizontal" | "vertical" | null, target: 0, displayed: 0, velocity: 0, ratchet: 0, vibration: 0 });

    useEffect(() => {
        const current = motion.current;
        dial.current = scene.getObjectByName("CTRL_Upper") ?? null;
        current.target = dial.current?.rotation.y ?? 0;
        current.displayed = current.target;
        current.ratchet = Math.round(current.target / RATCHET_STEP);
        // Copy only the HERO's existing center-plate tuning; never edit GLB bytes.
        const materials: THREE.Material[] = [];
        scene.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            const original = Array.isArray(child.material) ? child.material : [child.material];
            const updated = original.map((material) => {
                if (material.name !== "MAT_CenterPlate_Titanium" || !(material instanceof THREE.MeshStandardMaterial)) return material;
                const clone = material.clone();
                clone.metalness = 1;
                clone.roughness = 0.3;
                if (clone instanceof THREE.MeshPhysicalMaterial) { clone.anisotropy = 1; clone.anisotropyRotation = 0; }
                materials.push(clone);
                return clone;
            });
            child.material = Array.isArray(child.material) ? updated : updated[0];
        });
        return () => { dial.current = null; materials.forEach((material) => material.dispose()); };
    }, [scene]);

    useEffect(() => {
        const current = motion.current;
        function finish(pointer: number) {
            if (current.pointer !== pointer) return false;
            current.pointer = null;
            if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
            return true;
        }
        function move(event: PointerEvent) {
            if (current.pointer !== event.pointerId) return;
            if (event.pointerType === "mouse" && (event.buttons & 1) === 0) { finish(event.pointerId); return; }
            const dx = event.clientX - current.startX;
            const dy = event.clientY - current.startY;
            if (current.axis === null) {
                if (Math.hypot(dx, dy) < GESTURE_THRESHOLD) return;
                current.axis = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
            }
            if (current.axis === "vertical") { current.velocity = 0; return; }
            const rotationDelta = (event.clientX - current.previousX) * ROTATION_SENSITIVITY;
            const now = performance.now();
            const deltaTime = (now - current.lastTime) / 1000;
            current.target += rotationDelta;
            current.previousX = event.clientX;
            if (deltaTime > 0) current.velocity = rotationDelta / deltaTime;
            current.lastTime = now;
        }
        function up(event: PointerEvent) { if (finish(event.pointerId)) audio?.resume(); }
        function cancel(event: PointerEvent) { if (finish(event.pointerId)) { current.velocity = 0; audio?.pause(); } }
        function pause() {
            if (current.pointer !== null) finish(current.pointer);
            current.velocity = 0;
            audio?.pause();
        }
        function hidden() { if (document.hidden) pause(); }
        function key(event: Event) {
            const direction = (event as CustomEvent<number>).detail;
            audio?.resume();
            current.velocity = 0;
            current.target += direction * RATCHET_STEP;
        }
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", cancel);
        window.addEventListener("blur", pause);
        window.addEventListener("pagehide", pause);
        document.addEventListener("visibilitychange", hidden);
        canvas.addEventListener("muda:dial-step", key);
        return () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", cancel);
            window.removeEventListener("blur", pause);
            window.removeEventListener("pagehide", pause);
            document.removeEventListener("visibilitychange", hidden);
            canvas.removeEventListener("muda:dial-step", key);
            if (current.pointer !== null) finish(current.pointer);
            current.velocity = 0;
        };
    }, [audio, canvas]);

    function down(event: ThreeEvent<PointerEvent>) {
        const current = motion.current;
        if (event.button !== 0 || current.pointer !== null) return;
        event.stopPropagation();
        audio?.resume();
        current.pointer = event.pointerId;
        current.startX = current.previousX = event.clientX;
        current.startY = event.clientY;
        current.axis = null;
        current.lastTime = performance.now();
        canvas.setPointerCapture(event.pointerId);
    }

    useFrame(({ clock }, delta) => {
        if (!dial.current || document.hidden) return;
        const current = motion.current;
        const animationDelta = Math.min(delta, MAX_ANIMATION_DELTA);
        if (current.pointer === null) {
            current.target += current.velocity * animationDelta;
            current.velocity = THREE.MathUtils.damp(current.velocity, 0, FRICTION, animationDelta);
        }
        const ratchetIndex = Math.round(current.target / RATCHET_STEP);
        if (ratchetIndex !== current.ratchet) {
            audio?.play(Math.min(Math.abs(ratchetIndex - current.ratchet), 4));
            current.ratchet = ratchetIndex;
            current.vibration = 0.00015;
        }
        current.displayed = THREE.MathUtils.damp(current.displayed, applyRatchet(current.target), ROTATION_DAMPING, animationDelta);
        dial.current.rotation.y = current.displayed;
        const phase = clock.elapsedTime * VIBRATION_SPEED;
        group.current?.position.set(Math.sin(phase) * current.vibration, 0.01 + Math.cos(phase * 1.17) * current.vibration, Math.sin(phase * 0.83) * current.vibration * 0.5);
        current.vibration = THREE.MathUtils.damp(current.vibration, 0, VIBRATION_DAMPING, animationDelta);
    });

    return <group ref={group} position={[0, 0.01, 0]} onPointerDown={down}><primitive object={scene} dispose={null} /></group>;
}

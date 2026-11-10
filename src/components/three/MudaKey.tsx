"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, Raycaster, Vector2, type Object3D } from "three";

export const KEY_MODEL_URL = "/models/muda-key-v1.0.glb";
const PUSH_HANDLE = "KEY-push-handle";
// glTF is Y-up, in metres. Move the parent, not its scaled cap/stem children.
// This is a provisional visual stroke, not a force or spring simulation.
const TRAVEL = 0.004;
const PRESS_DAMPING = 35;
const RETURN_DAMPING = 22;

export function MudaKey() {
    const { scene: original } = useGLTF(KEY_MODEL_URL, false);
    const { gl, camera, controls, invalidate } = useThree();
    // Own transforms per viewer; preserve the GLB's materials, textures and loader cache.
    const scene = useMemo(() => original.clone(true), [original]);
    const { handle, restY } = useMemo(() => {
        const handle = scene.getObjectByName(PUSH_HANDLE);
        if (!handle) throw new Error(`KEY model is missing ${PUSH_HANDLE}`);
        for (const name of ["key_cap", "stem_head"]) {
            if (!handle.getObjectByName(name)) throw new Error(`KEY model is missing ${PUSH_HANDLE}/${name}`);
        }
        return { handle, restY: handle.position.y };
    }, [scene]);
    const moving = useRef<{ object: Object3D; restY: number } | null>(null);
    const motion = useRef({ pointer: null as number | null, startY: 0, target: 0, depth: 0 });

    useEffect(() => {
        moving.current = { object: handle, restY };
        const canvas = gl.domElement;
        const current = motion.current;
        const orbit = controls as unknown as { enabled: boolean } | null;
        const raycaster = new Raycaster();
        const pointer = new Vector2();
        let orbitWasEnabled = true;

        function release() {
            const id = current.pointer;
            current.pointer = null;
            current.target = 0;
            if (id !== null) {
                if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
                if (orbit) orbit.enabled = orbitWasEnabled;
            }
            invalidate();
        }
        function down(event: PointerEvent) {
            if (event.button !== 0 || !event.isPrimary || current.pointer !== null) return;
            const rect = canvas.getBoundingClientRect();
            pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
            scene.updateWorldMatrix(true, true);
            raycaster.setFromCamera(pointer, camera);
            const hit = raycaster.intersectObject(scene, true)[0];
            // A multi-material cap is a group of meshes. Check ancestry, not mesh names.
            let part: Object3D | null = hit?.object ?? null;
            while (part && part !== handle) part = part.parent;
            if (!part) return;
            // Capture phase runs before OrbitControls: pressing the cap cannot orbit the camera.
            event.preventDefault();
            event.stopImmediatePropagation();
            current.pointer = event.pointerId;
            current.startY = event.clientY;
            current.target = 0.15;
            if (orbit) { orbitWasEnabled = orbit.enabled; orbit.enabled = false; }
            canvas.setPointerCapture(event.pointerId);
            invalidate();
        }
        function move(event: PointerEvent) {
            if (current.pointer !== event.pointerId) return;
            if (event.pointerType === "mouse" && !(event.buttons & 1)) { release(); return; }
            const dragDistance = MathUtils.clamp(Math.min(canvas.clientWidth, canvas.clientHeight) * 0.25, 70, 140);
            current.target = MathUtils.clamp(0.15 + (event.clientY - current.startY) / dragDistance, 0, 1);
            invalidate();
        }
        function up(event: PointerEvent) { if (current.pointer === event.pointerId) release(); }
        function key(event: Event) {
            if (current.pointer !== null) return;
            current.target = (event as CustomEvent<boolean>).detail ? 1 : 0;
            invalidate();
        }
        function hidden() { if (document.hidden) release(); }
        canvas.addEventListener("pointerdown", down, true);
        canvas.addEventListener("lostpointercapture", up);
        canvas.addEventListener("muda:key-press", key);
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
        window.addEventListener("blur", release);
        window.addEventListener("pagehide", release);
        document.addEventListener("visibilitychange", hidden);
        return () => {
            canvas.removeEventListener("pointerdown", down, true);
            canvas.removeEventListener("lostpointercapture", up);
            canvas.removeEventListener("muda:key-press", key);
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
            window.removeEventListener("blur", release);
            window.removeEventListener("pagehide", release);
            document.removeEventListener("visibilitychange", hidden);
            release();
            current.depth = 0;
            handle.position.y = restY;
            moving.current = null;
        };
    }, [camera, controls, gl, handle, invalidate, restY, scene]);

    useFrame((_, delta) => {
        const current = motion.current;
        const damping = current.target === 0 ? RETURN_DAMPING : PRESS_DAMPING;
        current.depth = MathUtils.damp(current.depth, current.target, damping, Math.min(delta, 1 / 30));
        if (Math.abs(current.depth - current.target) < 0.0001) current.depth = current.target;
        const part = moving.current;
        if (part) part.object.position.y = part.restY - current.depth * TRAVEL;
        // Demand rendering rests when the key stops moving.
        if (current.depth !== current.target) invalidate();
    });

    return <primitive object={scene} dispose={null} />;
}

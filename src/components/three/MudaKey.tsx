"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, Raycaster, Vector2, type Object3D } from "three";
import { KEY_SWITCHES, keyDragInput, mapKeySwitchDepth, type KeySwitchId } from "@/lib/key-feel";

export const KEY_MODEL_URL = "/models/muda-key-v1.1.glb?v=20261117-170652";
const PUSH_HANDLE = "KEY-push-handle";
// glTF is Y-up, in metres. Move the parent, not its scaled cap/stem children.
// This is a provisional visual stroke, not a force or spring simulation.
const MAX_VISUAL_TRAVEL = 0.0105;

export function MudaKey({ axis }: { axis: KeySwitchId }) {
    const profile = KEY_SWITCHES[axis].motion;
    const { scene: original } = useGLTF(KEY_MODEL_URL, false);
    const { gl, camera, controls, invalidate } = useThree();
    // Own transforms per viewer; preserve the GLB's materials, textures and loader cache.
    const scene = useMemo(() => {
        const clone = original.clone(true);
        // v1.1 exports a presentation tilt on this parent. Normalize only our copy
        // so the existing camera, Y-half-turn and local press axis stay unchanged.
        clone.getObjectByName("KEY-whole-handle")?.quaternion.identity();
        return clone;
    }, [original]);
    const { handle, restY } = useMemo(() => {
        const handle = scene.getObjectByName(PUSH_HANDLE);
        if (!handle) throw new Error(`KEY model is missing ${PUSH_HANDLE}`);
        for (const name of ["key_cap", "stem_head"]) {
            if (!handle.getObjectByName(name))
                throw new Error(`KEY model is missing ${PUSH_HANDLE}/${name}`);
        }
        return { handle, restY: handle.position.y };
    }, [scene]);
    const moving = useRef<{ object: Object3D; restY: number } | null>(null);
    const motion = useRef({
        pointer: null as number | null,
        startY: 0,
        target: 0,
        depth: 0,
        latched: false,
    });

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
            current.latched = false;
            if (id !== null) {
                if (canvas.hasPointerCapture(id))
                    canvas.releasePointerCapture(id);
                if (orbit) orbit.enabled = orbitWasEnabled;
            }
            invalidate();
        }
        function down(event: PointerEvent) {
            if (
                event.button !== 0 ||
                !event.isPrimary ||
                current.pointer !== null
            )
                return;
            const rect = canvas.getBoundingClientRect();
            pointer.set(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                (-(event.clientY - rect.top) / rect.height) * 2 + 1,
            );
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
            const contact = mapKeySwitchDepth(axis, profile.initialDepth, false);
            current.target = contact.depth;
            current.latched = contact.latched;
            if (orbit) {
                orbitWasEnabled = orbit.enabled;
                orbit.enabled = false;
            }
            canvas.setPointerCapture(event.pointerId);
            invalidate();
        }
        function move(event: PointerEvent) {
            if (current.pointer !== event.pointerId) return;
            if (event.pointerType === "mouse" && !(event.buttons & 1)) {
                release();
                return;
            }
            const input = keyDragInput(
                profile,
                event.clientY - current.startY,
                Math.min(canvas.clientWidth, canvas.clientHeight),
            );
            const next = mapKeySwitchDepth(axis, input, current.latched);
            current.target = next.depth;
            current.latched = next.latched;
            invalidate();
        }
        function up(event: PointerEvent) {
            if (current.pointer === event.pointerId) release();
        }
        function key(event: Event) {
            if (current.pointer !== null) return;
            current.target = (event as CustomEvent<boolean>).detail ? 1 : 0;
            invalidate();
        }
        function hidden() {
            if (document.hidden) release();
        }
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
    }, [axis, camera, controls, gl, handle, invalidate, profile, restY, scene]);

    useFrame((_, delta) => {
        const current = motion.current;
        const damping = current.target === 0 ? profile.returnDamping : profile.pressDamping;
        current.depth = MathUtils.damp(
            current.depth,
            current.target,
            damping,
            Math.min(delta, 1 / 30),
        );
        if (Math.abs(current.depth - current.target) < 0.0001)
            current.depth = current.target;
        const part = moving.current;
        if (part) part.object.position.y = part.restY - current.depth * MathUtils.clamp(profile.travel, 0, MAX_VISUAL_TRAVEL);
        // Demand rendering rests when the key stops moving.
        if (current.depth !== current.target) invalidate();
    });

    // Face the opposite side on initial display; keep the GLB and local Y press axis intact.
    return <group rotation={[0, Math.PI, 0]}><primitive object={scene} dispose={null} /></group>;
}

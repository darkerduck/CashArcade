(() => {
    'use strict';
    const { W, H, aimAt, MAX_ANGLE } = Lightbubble;
    const CANCEL = 532;
    function point(canvas, x, y) {
        const box = canvas.getBoundingClientRect();
        const scale = Math.min(box.width / W, box.height / H);
        if (!scale) return null;
        return { x: (x - box.left - (box.width - W * scale) / 2) / scale,
            y: (y - box.top - (box.height - H * scale) / 2) / scale };
    }
    function create({ canvas, enabled, fire, swap, pause, retry, tool, changed, target = document }) {
        let active = null, angle = 0, cancel = false;
        const report = () => changed({ angle, cancel, dragging: active !== null });
        function aim(event) {
            const at = point(canvas, event.clientX, event.clientY);
            if (!at) return;
            cancel = active !== null && at.y >= CANCEL;
            if (!cancel) angle = aimAt(at.x, at.y);
            report();
        }
        function clear() {
            const id = active;
            active = null; cancel = false;
            if (id !== null && canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
            report();
        }
        canvas.addEventListener('pointerdown', event => {
            if (!enabled() || active !== null || event.button > 0) return;
            const at = point(canvas, event.clientX, event.clientY);
            if (!at || at.y < 0 || at.y >= CANCEL) return;
            event.preventDefault();
            active = event.pointerId;
            canvas.focus?.({ preventScroll: true });
            canvas.setPointerCapture?.(active);
            aim(event);
        });
        canvas.addEventListener('pointermove', event => {
            if (active === event.pointerId || (active === null && event.pointerType === 'mouse' && enabled())) aim(event);
        });
        canvas.addEventListener('pointerup', event => {
            if (active !== event.pointerId) return;
            aim(event);
            const shoot = !cancel && enabled();
            clear();
            if (shoot) fire(angle);
        });
        for (const name of ['pointercancel', 'lostpointercapture']) {
            canvas.addEventListener(name, event => { if (active === event.pointerId) clear(); });
        }
        target.addEventListener('keydown', event => {
            if (event.ctrlKey || event.metaKey || event.altKey || target.querySelector?.('dialog[open]') ||
                event.target.closest?.('input, select, textarea, [contenteditable]')) return;
            const key = event.key.toLowerCase();
            if (key === ' ' && event.target.closest?.('button, a, summary')) return;
            if (['escape', 'p', 'r'].includes(key)) {
                if (event.repeat) return;
                event.preventDefault();
                if (key === 'r') retry();
                else pause();
                return;
            }
            if (!enabled() || active !== null) return;
            if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) {
                event.preventDefault();
                const direction = key === 'arrowleft' || key === 'a' ? -1 : 1;
                angle = Math.min(MAX_ANGLE, Math.max(-MAX_ANGLE, angle + direction * (event.shiftKey ? .008 : .035)));
                report();
            } else if (!event.repeat && [' ', 'x', '1', '2', '3'].includes(key)) {
                event.preventDefault();
                if (key === ' ') fire(angle);
                else if (key === 'x') swap();
                else tool(['rainbow', 'pulse', 'drill'][Number(key) - 1]);
            }
        });
        return { clear, reset() { angle = 0; clear(); } };
    }
    globalThis.LightbubbleInput = Object.freeze({ create, point, CANCEL });
})();

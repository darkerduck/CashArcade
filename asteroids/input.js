(() => {
    'use strict';
    const keys = { a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right',
        w: 'thrust', arrowup: 'thrust', ' ': 'fire' };
    function create({ root = document, buttons, active, pause, retry, wake, changed }) {
        const down = new Map(), pointers = new Map();
        function value() {
            const result = { left: false, right: false, thrust: false, fire: false };
            for (const action of down.values()) result[action] = true;
            for (const { action } of pointers.values()) result[action] = true;
            return result;
        }
        function sync() {
            const actions = value();
            for (const button of buttons) button.dataset.held = String(actions[button.dataset.action]);
            changed?.(actions);
        }
        function clear() {
            const captures = [...pointers];
            down.clear();
            pointers.clear();
            for (const [id, { button }] of captures) {
                if (button.hasPointerCapture?.(id)) button.releasePointerCapture(id);
            }
            sync();
        }
        root.addEventListener('keydown', event => {
            if (event.altKey || event.metaKey || event.ctrlKey) return;
            const key = event.key.toLowerCase();
            if (event.target.closest?.('input, select, textarea, [contenteditable]')) return;
            if (key === ' ' && event.target.closest?.('button:not([data-action]), a, summary')) return;
            if (!keys[key] && !['p', 'escape', 'r'].includes(key)) return;
            event.preventDefault();
            if (keys[key]) {
                if (!active()) return;
                if (!event.repeat) wake();
                down.set(key, keys[key]);
                sync();
            } else if (!event.repeat) {
                if (key === 'r') retry();
                else pause();
            }
        });
        root.addEventListener('keyup', event => { if (down.delete(event.key.toLowerCase())) sync(); });
        for (const button of buttons) {
            button.addEventListener('pointerdown', event => {
                if (!active() || event.button > 0 || pointers.has(event.pointerId)) return;
                event.preventDefault();
                pointers.set(event.pointerId, { action: button.dataset.action, button });
                button.setPointerCapture?.(event.pointerId);
                wake();
                sync();
            });
            for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, event => {
                if (pointers.delete(event.pointerId)) sync();
            });
        }
        return { value, clear };
    }
    globalThis.StarshardInput = Object.freeze({ create });
})();

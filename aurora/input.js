(() => {
    'use strict';
    const actions = {
        a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right',
        s: 'brake', arrowdown: 'brake', ' ': 'nitro', shift: 'nitro'
    };
    function create({ buttons, enabled, pause, retry, wake, root = document }) {
        const keyboard = new Map(), pointers = new Map();
        function held(action) {
            return [...keyboard.values()].includes(action) || [...pointers.values()].some(p => p.action === action);
        }
        function value() {
            return { steer: Number(held('right')) - Number(held('left')), brake: held('brake'), nitro: held('nitro') };
        }
        function sync() {
            for (const button of buttons) button.dataset.held = String(held(button.dataset.drive));
        }
        function clear() {
            const capture = [...pointers];
            keyboard.clear(); pointers.clear();
            for (const [id, { button }] of capture) {
                if (button.hasPointerCapture?.(id)) button.releasePointerCapture(id);
            }
            sync();
        }
        root.addEventListener('keydown', event => {
            if (event.altKey || event.ctrlKey || event.metaKey || root.querySelector?.('dialog[open]') ||
                event.target.closest?.('input, textarea, select, [contenteditable]')) return;
            const key = event.key.toLowerCase(), action = actions[key];
            if (key === ' ' && event.target.closest?.('button, a, summary')) return;
            if (action) {
                if (!enabled()) return;
                event.preventDefault();
                if (!event.repeat) wake();
                keyboard.set(event.code || key, action);
                sync();
            } else if (['p', 'escape', 'r'].includes(key) && !event.repeat) {
                event.preventDefault();
                if (key === 'r') retry();
                else pause();
            }
        });
        root.addEventListener('keyup', event => {
            if (keyboard.delete(event.code || event.key.toLowerCase())) sync();
        });
        for (const button of buttons) {
            button.addEventListener('pointerdown', event => {
                if (!enabled() || event.button > 0 || pointers.has(event.pointerId)) return;
                event.preventDefault();
                pointers.set(event.pointerId, { action: button.dataset.drive, button });
                button.setPointerCapture?.(event.pointerId);
                wake(); sync();
            });
            for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
                button.addEventListener(event, e => { if (pointers.delete(e.pointerId)) sync(); });
            }
            button.addEventListener('contextmenu', event => event.preventDefault());
        }
        return { value, clear };
    }
    globalThis.AuroraInput = Object.freeze({ create });
})();

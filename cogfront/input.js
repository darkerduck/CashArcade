// 蒸汽前線 COGFRONT — keyboard and touch input. Movement is held state; actions are edge-triggered.
(() => {
    'use strict';
    const ACTIONS = { KeyJ: 'attack', KeyK: 'burst', KeyL: 'charge', KeyU: 'overdrive', Space: 'dodge', KeyQ: 'order',
        Digit1: 'deploy:sword', Digit2: 'deploy:lancer', Digit3: 'deploy:musket', Digit4: 'deploy:shield', Digit5: 'deploy:mechanic' };
    const LEFT = new Set(['KeyA', 'ArrowLeft']), RIGHT = new Set(['KeyD', 'ArrowRight']);
    function create({ target = globalThis.document, onAction = () => {}, onSystem = () => {} } = {}) {
        const held = new Set(), touch = { left: false, right: false, attack: false };
        let attackTimer = 0;
        function down(event) {
            if (event.target?.closest?.('input, select, textarea')) return;
            const code = event.code;
            if (['KeyP', 'Escape', 'KeyR', 'KeyF'].includes(code)) { onSystem(code, event); return; }
            if (LEFT.has(code) || RIGHT.has(code) || ACTIONS[code]) event.preventDefault?.();
            if (LEFT.has(code) || RIGHT.has(code)) { held.add(code); return; }
            if (code === 'KeyJ') held.add(code);
            if (ACTIONS[code] && !event.repeat) onAction(ACTIONS[code]);
        }
        function up(event) { held.delete(event.code); }
        target.addEventListener('keydown', down); target.addEventListener('keyup', up);
        function bind(element, name) {
            if (!element) return;
            const press = event => { event.preventDefault?.(); element.setPointerCapture?.(event.pointerId); element.classList?.add('active');
                if (name === 'left' || name === 'right' || name === 'attack') { touch[name] = true; if (name === 'attack') { onAction('attack'); attackTimer = .22; } } else onAction(name); };
            const release = () => { element.classList?.remove('active'); if (name in touch) touch[name] = false; };
            element.addEventListener('pointerdown', press);
            for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(type, release);
        }
        return {
            bind,
            // Holding J (or the touch blade button) keeps the three-hit combo going.
            value(dt = 0) {
                const left = [...LEFT].some(k => held.has(k)) || touch.left, right = [...RIGHT].some(k => held.has(k)) || touch.right;
                if (held.has('KeyJ') || touch.attack) { attackTimer -= dt; if (attackTimer <= 0) { attackTimer = .22; onAction('attack'); } }
                return { move: (right ? 1 : 0) - (left ? 1 : 0) };
            },
            clear() { held.clear(); touch.left = touch.right = touch.attack = false; },
        };
    }
    globalThis.CogfrontInput = Object.freeze({ create, ACTIONS });
})();

(() => {
'use strict';
const KEY = 'casharcade-prism-v1';
function clean(value, motion = false) {
    const data = {best:0,chain:0,motion:!!motion};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return data;
    for (const key of ['best','chain']) if (Number.isSafeInteger(value[key]) && value[key] >= 0 && value[key] <= 1e12) data[key] = value[key];
    if (typeof value.motion === 'boolean') data.motion = value.motion;
    return data;
}
function create(storage, motion = false) {
    let available = true;
    return {
        get available() { return available; },
        load() { try { return clean(JSON.parse(storage.getItem(KEY)),motion); } catch { available = false; return clean(null,motion); } },
        save(value) {
            try {
                const raw = JSON.stringify(clean(value,motion)); storage.setItem(KEY,raw);
                available = storage.getItem(KEY) === raw;
            } catch { available = false; }
            return available;
        }
    };
}
globalThis.PrismStackStorage = Object.freeze({KEY,clean,create});
})();

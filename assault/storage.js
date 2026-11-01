(() => {
    'use strict';
    const { Game, fresh, valid, validSnapshot } = NeonAssault;
    const KEY = 'casharcade-assault-round-v2';
    const OLD_KEY = 'casharcade-assault-checkpoint-v1';
    const BACKUP_KEY = 'casharcade.assault.paid-backup.v2';
    const RECOVERY_KEY = 'casharcade.assault.recovery.v2';

    function validRecord(record) {
        if (!record || record.version !== 2 || !Number.isSafeInteger(record.serial) || record.serial < 0
            || !Number.isSafeInteger(record.sequence) || record.sequence < 0
            || !valid(record.checkpoint) || !validSnapshot(record.game)
            || !['ready', 'active', 'stageClear', 'won', 'lost', 'pending', 'paid-ready'].includes(record.phase)
            || (record.phase === 'pending' ? !['retry', 'new'].includes(record.intent) : record.intent !== null)) return false;
        const state = record.game.state;
        return (record.phase === 'ready' && state === 'running')
            || (record.phase === 'active' && ['running', 'clearing'].includes(state))
            || (record.phase === 'stageClear' && state === 'stageClear')
            || (record.phase === 'won' && state === 'won')
            || (['lost', 'pending'].includes(record.phase) && state === 'lost')
            || (record.phase === 'paid-ready' && state === 'running');
    }

    function create(local = localStorage, session = sessionStorage) {
        function write(record) {
            if (!validRecord(record)) throw new Error('Invalid assault record');
            const value = JSON.stringify(record);
            local.setItem(KEY, value);
            if (local.getItem(KEY) !== value) throw new Error('Assault checkpoint was not retained');
            try { session.removeItem(RECOVERY_KEY); } catch { /* The newer local record remains authoritative. */ }
        }
        function backupRecovery(record) {
            if (!validRecord(record)) throw new Error('Invalid assault recovery');
            const value = JSON.stringify(record);
            session.setItem(RECOVERY_KEY, value);
            if (session.getItem(RECOVERY_KEY) !== value) throw new Error('Assault recovery was not retained');
        }
        function backup(record) {
            if (!validRecord(record) || record.phase !== 'paid-ready') throw new Error('Invalid paid backup');
            const value = JSON.stringify(record);
            session.setItem(BACKUP_KEY, value);
            if (session.getItem(BACKUP_KEY) !== value) throw new Error('Paid backup was not retained');
        }
        function clearBackup() { try { session.removeItem(BACKUP_KEY); } catch { /* Local record remains authoritative. */ } }
        function load() {
            try {
                const raw = local.getItem(KEY);
                let record = raw === null ? null : JSON.parse(raw);
                if (record && !validRecord(record)) record = null;
                let pendingBackup = null, recovery = null;
                const fallback = session.getItem(RECOVERY_KEY);
                if (fallback !== null) {
                    recovery = JSON.parse(fallback);
                    if (!validRecord(recovery)) throw new Error('Invalid assault recovery');
                }
                try {
                    const saved = session.getItem(BACKUP_KEY);
                    if (saved !== null) {
                        pendingBackup = JSON.parse(saved);
                        if (!validRecord(pendingBackup) || pendingBackup.phase !== 'paid-ready') throw new Error('Invalid paid backup');
                    }
                } catch (error) {
                    if (error instanceof SyntaxError || error.message === 'Invalid paid backup') throw error;
                    // Session storage may be disabled; a valid local record still works.
                }
                if (recovery && (!record || recovery.sequence > record.sequence)) record = recovery;
                if (pendingBackup && (!record || pendingBackup.sequence > record.sequence)) record = pendingBackup;
                if (record && (record === recovery || record === pendingBackup)) {
                    try { write(record); } catch { /* The session copy remains available. */ }
                }
                if (pendingBackup && record !== pendingBackup && record.phase !== 'paid-ready') clearBackup();
                if (record) return { record };
                if (raw !== null) throw new Error('Invalid assault record');
                const old = local.getItem(OLD_KEY);
                if (old !== null) {
                    const checkpoint = JSON.parse(old);
                    if (!valid(checkpoint)) throw new Error('Invalid legacy checkpoint');
                    record = { version: 2, serial: 0, sequence: 0, checkpoint, game: new Game(checkpoint).snapshot(), phase: 'ready', intent: null };
                    write(record);
                    local.removeItem(OLD_KEY);
                    return { record, migrated: true };
                }
                return { record: null };
            } catch { return { record: null, blocked: true }; }
        }
        return { load, write, backup, backupRecovery, clearBackup };
    }

    globalThis.NeonAssaultStorage = Object.freeze({ create, validRecord, KEY, OLD_KEY, BACKUP_KEY, RECOVERY_KEY, fresh });
})();

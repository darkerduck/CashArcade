(() => {
    'use strict';

    const root = document.documentElement;
    const themeToggle = document.querySelector('#theme-toggle');
    let storedTheme = '';

    try {
        storedTheme = localStorage.getItem('casharcade-theme') || '';
    } catch {
        // Use the dark default when storage is unavailable.
    }

    root.dataset.theme = storedTheme || 'dark';

    themeToggle.addEventListener('click', () => {
        const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        root.dataset.theme = nextTheme;

        try {
            localStorage.setItem('casharcade-theme', nextTheme);
        } catch {
            // Theme switching still works for the current page.
        }
    });
})();

(() => {
    'use strict';

    const root = document.documentElement;
    const themeToggle = document.querySelector('#theme-toggle');
    let storedTheme = '';

    try {
        storedTheme = localStorage.getItem('casharcade-theme') || '';
    } catch {
        // System preference is used when storage is unavailable.
    }

    root.dataset.theme = storedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

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

export const forceUiRefresh = () => {
  try {
    const root = document.documentElement;
    const body = document.body;

    // 1) forced reflow
    void root.offsetHeight;
    void body.offsetHeight;

    // 2) forced repaint
    body.style.transform = 'translateZ(0)';
    body.style.willChange = 'transform';
    body.style.opacity = '0.9999';

    requestAnimationFrame(() => {
      void body.offsetHeight;

      body.style.transform = '';
      body.style.willChange = '';
      body.style.opacity = '';
    });

    // 3) second pass for Electron glitches
    setTimeout(() => {
      body.style.transform = 'translateZ(0)';
      void body.offsetHeight;
      body.style.transform = '';
    }, 0);
  } catch (error) {
    console.error('forceUiRefresh error:', error);
  }
};
let confirmContainer: HTMLDivElement | null = null;

const ensureConfirmContainer = () => {
  if (confirmContainer && document.body.contains(confirmContainer)) {
    return confirmContainer;
  }

  confirmContainer = document.createElement('div');
  confirmContainer.id = 'app-confirm-container';
  document.body.appendChild(confirmContainer);
  return confirmContainer;
};

const getThemeVar = (name: string, fallback: string) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

export const appConfirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const container = ensureConfirmContainer();

    const cardBg = getThemeVar('--card-bg', '#ffffff');
    const textColor = getThemeVar('--text-color', '#0f172a');
    const textMuted = getThemeVar('--text-muted', '#64748b');
    const borderColor = getThemeVar('--border-color', '#e2e8f0');
    const themePrimary = getThemeVar('--theme-primary', '#10b981');
    const themePrimarySoft = getThemeVar('--theme-primary-soft', 'rgba(16, 185, 129, 0.10)');
    const appBg = getThemeVar('--app-bg', '#f8fafc');

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(15, 23, 42, 0.45)';
    overlay.style.backdropFilter = 'blur(6px)';
    (overlay.style as any).webkitBackdropFilter = 'blur(6px)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '16px';

    const box = document.createElement('div');
    box.dir = 'rtl';
    box.style.width = '100%';
    box.style.maxWidth = '420px';
    box.style.background = cardBg;
    box.style.border = `1px solid ${borderColor}`;
    box.style.borderRadius = '32px';
    box.style.boxShadow = '0 24px 60px rgba(0,0,0,0.22)';
    box.style.padding = '24px';
    box.style.fontFamily = 'sans-serif';
    box.style.color = textColor;

    const iconWrap = document.createElement('div');
    iconWrap.style.width = '56px';
    iconWrap.style.height = '56px';
    iconWrap.style.borderRadius = '20px';
    iconWrap.style.display = 'flex';
    iconWrap.style.alignItems = 'center';
    iconWrap.style.justifyContent = 'center';
    iconWrap.style.margin = '0 auto 16px auto';
    iconWrap.style.background = themePrimarySoft;
    iconWrap.style.color = themePrimary;
    iconWrap.style.fontSize = '24px';
    iconWrap.style.fontWeight = '900';
    iconWrap.textContent = '!';

    const title = document.createElement('div');
    title.textContent = 'تأكيد العملية';
    title.style.fontSize = '20px';
    title.style.fontWeight = '900';
    title.style.color = textColor;
    title.style.textAlign = 'center';
    title.style.marginBottom = '10px';
    title.style.letterSpacing = '-0.02em';

    const text = document.createElement('div');
    text.textContent = message;
    text.style.fontSize = '15px';
    text.style.fontWeight = '800';
    text.style.color = textMuted;
    text.style.marginBottom = '22px';
    text.style.lineHeight = '1.9';
    text.style.textAlign = 'center';
    text.style.whiteSpace = 'pre-wrap';
    text.style.wordBreak = 'break-word';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '12px';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'إلغاء';
    cancelBtn.style.flex = '1';
    cancelBtn.style.border = `1px solid ${borderColor}`;
    cancelBtn.style.borderRadius = '18px';
    cancelBtn.style.padding = '14px 16px';
    cancelBtn.style.fontWeight = '900';
    cancelBtn.style.fontSize = '14px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.background = themePrimarySoft || appBg;
    cancelBtn.style.color = textColor;
    cancelBtn.style.transition = 'all 0.2s ease';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = 'تأكيد';
    confirmBtn.style.flex = '1';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '18px';
    confirmBtn.style.padding = '14px 16px';
    confirmBtn.style.fontWeight = '900';
    confirmBtn.style.fontSize = '14px';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.background = '#dc2626';
    confirmBtn.style.color = '#ffffff';
    confirmBtn.style.transition = 'all 0.2s ease';
    confirmBtn.style.boxShadow = '0 14px 28px rgba(220, 38, 38, 0.24)';

    const cleanup = (result: boolean) => {
      if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
      resolve(result);
    };

    cancelBtn.onmouseenter = () => {
      cancelBtn.style.transform = 'translateY(-1px)';
      cancelBtn.style.filter = 'brightness(0.98)';
    };

    cancelBtn.onmouseleave = () => {
      cancelBtn.style.transform = 'translateY(0)';
      cancelBtn.style.filter = 'none';
    };

    confirmBtn.onmouseenter = () => {
      confirmBtn.style.transform = 'translateY(-1px)';
      confirmBtn.style.filter = 'brightness(0.96)';
    };

    confirmBtn.onmouseleave = () => {
      confirmBtn.style.transform = 'translateY(0)';
      confirmBtn.style.filter = 'none';
    };

    cancelBtn.onclick = () => cleanup(false);
    confirmBtn.onclick = () => cleanup(true);

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        cleanup(false);
      }
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    box.appendChild(iconWrap);
    box.appendChild(title);
    box.appendChild(text);
    box.appendChild(actions);
    overlay.appendChild(box);
    container.appendChild(overlay);
  });
};
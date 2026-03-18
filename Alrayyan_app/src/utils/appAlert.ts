let alertContainer: HTMLDivElement | null = null;

const ensureContainer = () => {
  if (alertContainer && document.body.contains(alertContainer)) {
    return alertContainer;
  }

  alertContainer = document.createElement('div');
  alertContainer.id = 'app-alert-container';
  alertContainer.style.position = 'fixed';
  alertContainer.style.top = '20px';
  alertContainer.style.left = '20px';
  alertContainer.style.zIndex = '999999';
  alertContainer.style.display = 'flex';
  alertContainer.style.flexDirection = 'column';
  alertContainer.style.gap = '10px';
  alertContainer.style.pointerEvents = 'none';

  document.body.appendChild(alertContainer);
  return alertContainer;
};

type AlertType = 'success' | 'error' | 'info' | 'warning';

const getThemeVar = (name: string, fallback: string) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const getStylesByType = (type: AlertType) => {
  const cardBg = getThemeVar('--card-bg', '#ffffff');
  const textColor = getThemeVar('--text-color', '#0f172a');
  const borderColor = getThemeVar('--border-color', '#e2e8f0');
  const themePrimary = getThemeVar('--theme-primary', '#10b981');

  switch (type) {
    case 'success':
      return {
        background: cardBg,
        color: textColor,
        border: 'rgba(22, 163, 74, 0.28)',
        accent: '#16a34a',
        iconBg: 'rgba(22, 163, 74, 0.12)',
        shadow: '0 16px 40px rgba(22, 163, 74, 0.12)'
      };

    case 'error':
      return {
        background: cardBg,
        color: textColor,
        border: 'rgba(220, 38, 38, 0.28)',
        accent: '#dc2626',
        iconBg: 'rgba(220, 38, 38, 0.12)',
        shadow: '0 16px 40px rgba(220, 38, 38, 0.12)'
      };

    case 'warning':
      return {
        background: cardBg,
        color: textColor,
        border: 'rgba(217, 119, 6, 0.28)',
        accent: '#d97706',
        iconBg: 'rgba(217, 119, 6, 0.12)',
        shadow: '0 16px 40px rgba(217, 119, 6, 0.12)'
      };

    case 'info':
    default:
      return {
        background: cardBg,
        color: textColor,
        border: borderColor,
        accent: themePrimary,
        iconBg: getThemeVar('--theme-primary-soft', 'rgba(16, 185, 129, 0.10)'),
        shadow: '0 16px 40px rgba(0,0,0,0.12)'
      };
  }
};

const getIconByType = (type: AlertType) => {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warning':
      return '!';
    case 'info':
    default:
      return 'i';
  }
};

export const appAlert = (
  message: string,
  type: AlertType = 'info',
  duration = 2500
) => {
  const container = ensureContainer();
  const toast = document.createElement('div');
  const styles = getStylesByType(type);
  const textMuted = getThemeVar('--text-muted', '#64748b');

  toast.dir = 'rtl';
  toast.style.pointerEvents = 'auto';
  toast.style.minWidth = '280px';
  toast.style.maxWidth = '420px';
  toast.style.padding = '14px';
  toast.style.borderRadius = '22px';
  toast.style.border = `1px solid ${styles.border}`;
  toast.style.boxShadow = styles.shadow;
  toast.style.background = styles.background;
  toast.style.color = styles.color;
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-8px)';
  toast.style.transition = 'opacity 180ms ease, transform 180ms ease';
  toast.style.cursor = 'pointer';
  toast.style.backdropFilter = 'blur(8px)';
  (toast.style as any).webkitBackdropFilter = 'blur(8px)';

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'flex-start';
  row.style.gap = '12px';

  const iconWrap = document.createElement('div');
  iconWrap.style.width = '38px';
  iconWrap.style.height = '38px';
  iconWrap.style.flexShrink = '0';
  iconWrap.style.borderRadius = '14px';
  iconWrap.style.display = 'flex';
  iconWrap.style.alignItems = 'center';
  iconWrap.style.justifyContent = 'center';
  iconWrap.style.background = styles.iconBg;
  iconWrap.style.color = styles.accent;
  iconWrap.style.fontWeight = '900';
  iconWrap.style.fontSize = '18px';
  iconWrap.textContent = getIconByType(type);

  const content = document.createElement('div');
  content.style.flex = '1';
  content.style.minWidth = '0';

  const title = document.createElement('div');
  title.style.fontSize = '13px';
  title.style.fontWeight = '900';
  title.style.marginBottom = '4px';
  title.style.color = styles.accent;
  title.textContent =
    type === 'success'
      ? 'تم بنجاح'
      : type === 'error'
      ? 'حدث خطأ'
      : type === 'warning'
      ? 'تنبيه'
      : 'معلومة';

  const text = document.createElement('div');
  text.textContent = message;
  text.style.fontSize = '14px';
  text.style.fontWeight = '800';
  text.style.lineHeight = '1.7';
  text.style.color = type === 'info' ? textMuted : styles.color;
  text.style.whiteSpace = 'pre-wrap';
  text.style.wordBreak = 'break-word';

  content.appendChild(title);
  content.appendChild(text);

  row.appendChild(iconWrap);
  row.appendChild(content);
  toast.appendChild(row);
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  const removeToast = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    window.setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 180);
  };

  const timer = window.setTimeout(removeToast, duration);

  toast.addEventListener('mouseenter', () => {
    toast.style.transform = 'translateY(-2px)';
  });

  toast.addEventListener('mouseleave', () => {
    toast.style.transform = 'translateY(0)';
  });

  toast.addEventListener('click', () => {
    clearTimeout(timer);
    removeToast();
  });
};

export const appSuccess = (message: string, duration?: number) =>
  appAlert(message, 'success', duration);

export const appError = (message: string, duration?: number) =>
  appAlert(message, 'error', duration);

export const appInfo = (message: string, duration?: number) =>
  appAlert(message, 'info', duration);

export const appWarning = (message: string, duration?: number) =>
  appAlert(message, 'warning', duration);
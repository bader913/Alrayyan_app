export const appAlert = (message: string) => {
  setTimeout(() => {
    window.alert(message);
    setTimeout(() => {
      window.focus();
      document.body.focus();
      window.dispatchEvent(new Event('resize'));
    }, 0);
  }, 0);
};

export const appConfirm = async (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const result = window.confirm(message);

      setTimeout(() => {
        window.focus();
        document.body.focus();
        window.dispatchEvent(new Event('resize'));
      }, 0);

      resolve(result);
    }, 0);
  });
};
export const notifySuccess = (message: string) => {
  console.log(`✅ ${message}`);
};

export const notifyError = (message: string) => {
  console.error(`❌ ${message}`);
};

export const notifyInfo = (message: string) => {
  console.log(`ℹ️ ${message}`);
};
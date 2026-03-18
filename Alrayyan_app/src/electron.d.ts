export {};

declare global {
  interface Window {
    electronAPI?: {
      zoomIn?: () => unknown;
      zoomOut?: () => unknown;
      resetZoom?: () => unknown;
      printReceipt: (payload: {
        html: string;
        printerName?: string;
      }) => Promise<{
        success: boolean;
        message?: string;
      }>;
      previewReceipt: (payload: {
        html: string;
        printerName?: string;
      }) => Promise<{
        success: boolean;
        message?: string;
      }>;
    };

    receiptPreviewAPI?: {
      print: (payload: {
        html: string;
        printerName?: string;
      }) => Promise<{
        success: boolean;
        message?: string;
      }>;
      close: () => void;
    };
  }
}
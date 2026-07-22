// `qz-tray` không kèm type khai báo — chỉ khai báo phần bề mặt API thực sự
// dùng trong app (xem @/services/printing.ts).
declare module 'qz-tray' {
  interface QzConfig {
    // Cấu hình in raw ESC/POS — không cần field cụ thể, đối tượng do
    // qz.configs.create() sinh ra và truyền thẳng vào qz.print().
    [key: string]: unknown;
  }

  interface QzApi {
    websocket: {
      isActive: () => boolean;
      connect: (options?: {
        retries?: number;
        delay?: number;
        host?: string | string[];
      }) => Promise<void>;
      disconnect: () => Promise<void>;
    };
    security: {
      setCertificatePromise: (
        handler: (resolve: (cert: string) => void, reject: (err: unknown) => void) => void,
      ) => void;
      setSignaturePromise: (
        factory: (
          toSign: string,
        ) => (resolve: (sig: string) => void, reject: (err: unknown) => void) => void,
      ) => void;
      setSignatureAlgorithm: (algorithm: 'SHA1' | 'SHA256' | 'SHA512') => void;
    };
    printers: {
      find: (query?: string) => Promise<string[] | string>;
    };
    configs: {
      create: (printer: string, options?: Record<string, unknown>) => QzConfig;
    };
    print: (config: QzConfig, data: string[]) => Promise<void>;
  }

  const qz: QzApi;
  export default qz;
}

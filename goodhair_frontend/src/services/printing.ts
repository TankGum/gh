'use client';

import qz from 'qz-tray';

// In hoá đơn ra máy in nhiệt tại quầy qua QZ Tray (app cài sẵn trên máy tính
// quầy). Backend ký từng lệnh in bằng khoá riêng (xem app/services/printing
// ở backend) nên in hoàn toàn im lặng — không hiện popup xác nhận.
//
// Yêu cầu máy tính tại quầy: đã cài & mở QZ Tray, và đã import chứng chỉ
// backend cấp làm "trusted" trong QZ Tray (Advanced > Site Manager).

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002/api/v1';
const PRINTER_STORAGE_KEY = 'goodhair.selectedPrinter';

let securityConfigured = false;

function configureSecurity() {
  if (securityConfigured) return;
  securityConfigured = true;

  qz.security.setCertificatePromise((resolve, reject) => {
    fetch(`${API_URL}/print/cert`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Không lấy được chứng chỉ in'))))
      .then((body: { certificate: string }) => resolve(body.certificate))
      .catch(reject);
  });

  qz.security.setSignatureAlgorithm('SHA512');
  qz.security.setSignaturePromise(toSign => (resolve, reject) => {
    fetch(`${API_URL}/print/sign`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: toSign }),
    })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Ký lệnh in thất bại'))))
      .then((body: { signature: string }) => resolve(body.signature))
      .catch(reject);
  });
}

async function ensureConnected(): Promise<void> {
  configureSecurity();
  if (qz.websocket.isActive()) return;
  try {
    await qz.websocket.connect({ retries: 1, delay: 1 });
  } catch {
    throw new Error('Không kết nối được QZ Tray. Kiểm tra QZ Tray đã cài và đang chạy trên máy này chưa.');
  }
}

export async function listPrinters(): Promise<string[]> {
  await ensureConnected();
  const result = await qz.printers.find();
  return Array.isArray(result) ? result : [result];
}

export function getSavedPrinter(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(PRINTER_STORAGE_KEY);
}

export function savePrinter(name: string): void {
  window.localStorage.setItem(PRINTER_STORAGE_KEY, name);
}

// `commands` là mảng các chuỗi ESC/POS thô (mỗi phần tử = 1 đoạn byte gửi
// thẳng tới máy in) — xem @/services/receiptTemplate.ts để build nội dung.
export async function printRaw(commands: string[]): Promise<void> {
  const printer = getSavedPrinter();
  if (!printer) {
    throw new Error('Chưa chọn máy in — vào "Cấu hình máy in" để chọn trước.');
  }
  await ensureConnected();
  const config = qz.configs.create(printer);
  await qz.print(config, commands);
}

// Dựng nội dung hoá đơn dạng lệnh ESC/POS thô cho máy in nhiệt khổ 58mm
// (32 ký tự/dòng ở font mặc định — máy 80mm vẫn in được, chỉ dư khoảng
// trắng bên phải).
//
// Máy in nhiệt hầu hết không hỗ trợ UTF-8 hay bảng mã tiếng Việt thống nhất
// giữa các hãng, nên để chắc chắn không bị lỗi phông/ký tự lạ, hoá đơn in ra
// bỏ dấu tiếng Việt (Cắt tóc -> Cat toc). Nếu máy in của bạn xác nhận hỗ trợ
// bảng mã CP1258 (tiếng Việt) qua lệnh ESC t <n>, có thể bỏ bước stripDiacritics
// bên dưới và thêm lệnh chọn bảng mã tương ứng với model máy in cụ thể.

const WIDTH = 32;

const ESC = '\x1B';
const GS = '\x1D';

const CMD = {
  init: ESC + '@',
  alignLeft: ESC + 'a' + '\x00',
  alignCenter: ESC + 'a' + '\x01',
  boldOn: ESC + 'E' + '\x01',
  boldOff: ESC + 'E' + '\x00',
  doubleSize: GS + '!' + '\x11',
  normalSize: GS + '!' + '\x00',
  feed: (n: number) => ESC + 'd' + String.fromCharCode(n),
  cut: GS + 'V' + '\x01',
};

// Bỏ dấu tiếng Việt: tách tổ hợp NFD rồi loại các dấu kết hợp (combining
// marks, U+0300-U+036F), riêng "đ/Đ" không tách được bằng NFD nên map tay.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function line(char = '-'): string {
  return char.repeat(WIDTH);
}

// Ghép 2 đoạn text sao cho `left` canh trái, `right` canh phải, đủ WIDTH cột.
// Nếu tổng dài hơn WIDTH, xuống dòng: left ở dòng riêng, right canh phải dòng dưới.
function twoCol(left: string, right: string): string {
  const l = stripDiacritics(left);
  const r = stripDiacritics(right);
  const gap = WIDTH - l.length - r.length;
  if (gap >= 1) return l + ' '.repeat(gap) + r + '\n';
  return l + '\n' + ' '.repeat(Math.max(0, WIDTH - r.length)) + r + '\n';
}

function fmtVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + 'd';
}

export interface ReceiptData {
  shopName: string;
  branchName: string;
  branchAddress?: string | null;
  branchPhone?: string | null;
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  employeeName?: string | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm hoặc HH:mm:ss
  services: { name: string; price: number }[];
  total: number;
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export function buildReceiptCommands(data: ReceiptData): string[] {
  const out: string[] = [CMD.init, CMD.alignCenter];

  out.push(CMD.doubleSize + stripDiacritics(data.shopName) + '\n' + CMD.normalSize);
  if (data.branchName) out.push(stripDiacritics(data.branchName) + '\n');
  if (data.branchAddress) out.push(stripDiacritics(data.branchAddress) + '\n');
  if (data.branchPhone) out.push(stripDiacritics(`DT: ${data.branchPhone}`) + '\n');

  out.push(CMD.alignLeft);
  out.push(line() + '\n');
  out.push(twoCol(`Ma: ${data.bookingCode}`, `${fmtDate(data.date)} ${data.startTime.slice(0, 5)}`));
  out.push(stripDiacritics(`KH: ${data.customerName}`) + '\n');
  out.push(stripDiacritics(`SDT: ${data.customerPhone}`) + '\n');
  if (data.employeeName) out.push(stripDiacritics(`Barber: ${data.employeeName}`) + '\n');

  out.push(line() + '\n');
  for (const svc of data.services) {
    out.push(twoCol(svc.name, fmtVnd(svc.price)));
  }
  out.push(line() + '\n');

  out.push(CMD.boldOn);
  out.push(twoCol('TONG CONG:', fmtVnd(data.total)));
  out.push(CMD.boldOff);
  out.push(line() + '\n');

  out.push(CMD.alignCenter);
  out.push('Cam on quy khach!\n');
  out.push('Hen gap lai\n');

  out.push(CMD.feed(3));
  out.push(CMD.cut);

  return out;
}

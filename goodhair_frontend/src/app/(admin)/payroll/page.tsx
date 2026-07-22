import type { Metadata } from 'next';
import PayrollClient from './PayrollClient';

export const metadata: Metadata = { title: 'Bảng lương | GoodHair' };

export default function PayrollPage() {
  return (
    <div className="p-4 md:p-7">
      <PayrollClient />
    </div>
  );
}

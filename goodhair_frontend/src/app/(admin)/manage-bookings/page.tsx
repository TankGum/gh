import type { Metadata } from 'next';
import ManageBookingsClient from './ManageBookingsClient';

export const metadata: Metadata = { title: 'Quản lý đặt lịch | GoodHair' };

export default function ManageBookingsPage() {
  return (
    <div className="p-4 md:p-7">
      <ManageBookingsClient />
    </div>
  );
}

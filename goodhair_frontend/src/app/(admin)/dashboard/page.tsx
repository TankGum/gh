import type { Metadata } from 'next';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = { title: 'Tổng quan | GoodHair' };

export default function DashboardPage() {
  return (
    <div className="p-4 md:p-7">
      <DashboardClient />
    </div>
  );
}

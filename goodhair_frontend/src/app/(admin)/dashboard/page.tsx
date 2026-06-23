import type { Metadata } from 'next';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = { title: 'Tổng quan | GoodHair' };

export default function DashboardPage() {
  return (
    <div style={{ padding: 28 }}>
      <DashboardClient />
    </div>
  );
}

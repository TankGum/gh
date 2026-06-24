import type { Metadata } from 'next';
import RevenueClient from './RevenueClient';

export const metadata: Metadata = { title: 'Doanh thu | GoodHair' };

export default function RevenuePage() {
  return (
    <div className="p-4 md:p-7">
      <RevenueClient />
    </div>
  );
}

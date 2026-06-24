import type { Metadata } from 'next';
import CustomersClient from './CustomersClient';

export const metadata: Metadata = { title: 'Khách hàng | GoodHair' };

export default function CustomersPage() {
  return (
    <div className="p-4 md:p-7">
      <CustomersClient />
    </div>
  );
}

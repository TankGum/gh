import type { Metadata } from 'next';
import CustomersClient from './CustomersClient';

export const metadata: Metadata = { title: 'Khách hàng | GoodHair' };

export default function CustomersPage() {
  return (
    <div style={{ padding: 28 }}>
      <CustomersClient />
    </div>
  );
}

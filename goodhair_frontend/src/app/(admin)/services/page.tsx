import { Metadata } from 'next';
import ServiceClient from './ServiceClient';

export const metadata: Metadata = {
  title: 'Dịch vụ & bảng giá | GoodHair',
};

export default function ServicesPage() {
  return (
    <div className="p-8">
      <ServiceClient />
    </div>
  );
}

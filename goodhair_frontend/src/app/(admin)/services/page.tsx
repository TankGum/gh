import { Metadata } from 'next';
import ServiceClient from './ServiceClient';

export const metadata: Metadata = {
  title: 'Dịch vụ| GoodHair',
};

export default function ServicesPage() {
  return (
    <div className="p-4 md:p-8">
      <ServiceClient />
    </div>
  );
}

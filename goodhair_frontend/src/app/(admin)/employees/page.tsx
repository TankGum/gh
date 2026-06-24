import type { Metadata } from 'next';
import EmployeesClient from './EmployeesClient';

export const metadata: Metadata = { title: 'Nhân viên | GoodHair' };

export default function EmployeesPage() {
  return (
    <div className="p-4 md:p-7">
      <EmployeesClient />
    </div>
  );
}

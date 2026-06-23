import { Metadata } from 'next';
import BranchClient from './BranchClient';

export const metadata: Metadata = {
  title: 'Chi nhánh | GoodHair',
};

export default function BranchesPage() {
  return (
    <div className="p-8">
      <BranchClient />
    </div>
  );
}

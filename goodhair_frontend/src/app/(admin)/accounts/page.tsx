import type { Metadata } from 'next';
import AccountsClient from './AccountsClient';

export const metadata: Metadata = { title: 'Tài khoản | GoodHair' };

export default function AccountsPage() {
  return (
    <div className="p-8">
      <AccountsClient />
    </div>
  );
}

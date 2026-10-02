import type { Metadata } from 'next';
import { SearchView } from '@/components/menu/SearchView';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search dishes and drinks at The Olive Table.',
};

export default function SearchPage() {
  return <SearchView />;
}

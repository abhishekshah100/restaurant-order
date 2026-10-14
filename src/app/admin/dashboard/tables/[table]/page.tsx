import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { getTableNumbersServer } from '@/api/server';
import { TableDetail } from '@/components/admin/tables/TableDetail';

interface Props {
  params: Promise<{ table: string }>;
}

export const dynamicParams = false;

/** A page per table on any branch's floor plan; each branch's own tables come from the API. */
export async function generateStaticParams() {
  return (await getTableNumbersServer()).map((table) => ({ table: String(table) }));
}

export async function generateMetadata({ params }: Props) {
  return adminMetadata('table', { table: (await params).table });
}

export default async function AdminTablePage({ params }: Props) {
  return <TableDetail table={Number((await params).table)} />;
}

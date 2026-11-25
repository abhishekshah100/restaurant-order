import { adminMetadata } from '@/app/admin/dashboard/adminMetadata';
import { PhotosSettings } from '@/components/admin/settings/PhotosSettings';

export const generateMetadata = () => adminMetadata('photos');

export default function AdminPhotosSettingsPage() {
  return <PhotosSettings />;
}

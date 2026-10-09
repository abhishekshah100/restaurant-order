import { AdminAccess } from './AdminAccess';
import { AdminHeader } from './AdminHeader';
import styles from './AdminDashboard.module.css';

const COPY = {
  title: 'Dashboard',
  empty: 'Your dashboard will appear here.',
} as const;

function DashboardContent() {
  return (
    <main className={styles.main}>
      <h1>{COPY.title}</h1>
      <p>{COPY.empty}</p>
    </main>
  );
}

export function AdminDashboard() {
  return (
    <AdminAccess>
      <div className={styles.page}>
        <AdminHeader />
        <DashboardContent />
      </div>
    </AdminAccess>
  );
}

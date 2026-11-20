import { PublishCenter } from '../components/publishing/PublishCenter';
import { Outlet } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';

const Layout = () => {
  return (
    <AppShell>
      <Outlet />
      <PublishCenter />
    </AppShell>
  );
};

export default Layout;

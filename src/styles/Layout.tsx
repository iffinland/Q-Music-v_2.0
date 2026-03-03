import { Outlet } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';

const Layout = () => {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

export default Layout;

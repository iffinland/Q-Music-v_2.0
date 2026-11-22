import { PublishCenter } from '../components/publishing/PublishCenter';
import { AppShell } from '../components/shell/AppShell';
import { MediaDetailOutlet } from '../components/common/MediaDetailOutlet';

const Layout = () => (
  <AppShell>
    <MediaDetailOutlet />
    <PublishCenter />
  </AppShell>
);
export default Layout;

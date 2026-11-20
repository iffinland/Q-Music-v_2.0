import { AuthProvider } from './qortal';
import Layout from './styles/Layout';
export const AppWrapper = () => (
  <AuthProvider>
    <Layout />
  </AuthProvider>
);

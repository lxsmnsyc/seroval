import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import type { JSX } from '@solidjs/web';
import { onSettled } from 'solid-js';
import Drawer from './components/Drawer';
import Footer from './components/Footer';
import Header from './components/Header';
import Search from './components/Search';
import onCopyClick from './lib/copy';
import { onPackageManagerClick } from './lib/package-manager';
import Router from './router';
import './styles.css';

export default function App(): JSX.Element {
  onSettled(() => {
    document.addEventListener('click', onCopyClick);
    document.addEventListener('click', onPackageManagerClick);
    return () => {
      document.removeEventListener('click', onCopyClick);
      document.removeEventListener('click', onPackageManagerClick);
    };
  });

  return (
    <Router>
      {(props) => (
        <>
          <Header />
          <main class="site-main">{props.children}</main>
          <Footer />
          <Search />
          <Drawer />
        </>
      )}
    </Router>
  );
}

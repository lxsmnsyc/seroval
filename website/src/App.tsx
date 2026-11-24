import type { JSX } from '@solidjs/web';
import { onSettled } from 'solid-js';
import Drawer from './components/Drawer';
import Footer from './components/Footer';
import Header from './components/Header';
import Search from './components/Search';
import onCopyClick from './lib/copy';
import { onPackageManagerClick } from './lib/package-manager';
import { placeThumbs, watchThumbs } from './lib/thumb';
import Router from './router';
import './styles.css';

export default function App(): JSX.Element {
  onSettled(() => {
    document.addEventListener('click', onCopyClick);
    document.addEventListener('click', onPackageManagerClick);
    placeThumbs();
    const stopThumbs = watchThumbs();
    return () => {
      document.removeEventListener('click', onCopyClick);
      document.removeEventListener('click', onPackageManagerClick);
      stopThumbs();
    };
  });

  return (
    <Router>
      {(props) => (
        <>
          <a class="skip" href="#main">
            Skip to content
          </a>
          <Header />
          <main id="main" tabindex="-1">
            {props.children}
          </main>
          <Footer />
          <Search />
          <Drawer />
        </>
      )}
    </Router>
  );
}

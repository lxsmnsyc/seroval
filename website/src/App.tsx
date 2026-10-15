import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import type { JSX } from '@solidjs/web';
import { onSettled } from 'solid-js';
import Drawer from './components/Drawer';
import Footer from './components/Footer';
import Header from './components/Header';
import Search from './components/Search';
import onCopyClick from './lib/copy';
import Router from './router';
import './styles.css';

export default function App(): JSX.Element {
  onSettled(() => {
    document.addEventListener('click', onCopyClick);
    return () => {
      document.removeEventListener('click', onCopyClick);
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

import Header from './components/Header';
import { Router } from './router';
import './styles.css';

export default function App() {
  return (
    <Router>
      {props => (
        <>
          <Header />
          <main>{props.children}</main>
        </>
      )}
    </Router>
  );
}

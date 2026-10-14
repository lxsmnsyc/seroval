import ThemeToggle from './ThemeToggle';

export default function Header() {
  return (
    <header class="site-header">
      <a class="logo" href="/">
        seroval
      </a>
      <nav class="site-nav">
        <a href="/docs/serialization">Docs</a>
        <a href="/playground">Playground</a>
        <a
          href="https://github.com/lxsmnsyc/seroval"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <ThemeToggle />
      </nav>
    </header>
  );
}

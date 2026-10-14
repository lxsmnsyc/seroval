import type { JSX } from '@solidjs/web';

type IconProps = { class?: string };

function Icon(props: IconProps & { children: JSX.Element }) {
  return (
    <svg
      class={['icon', props.class]}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

export function LogoMark(props: IconProps) {
  return (
    <svg class={['logo-mark', props.class]} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ff4d8d" />
          <stop offset="1" stop-color="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-gradient)" />
      <path
        d="M12.5 9.5c-2 0-3 1-3 3v1.5c0 1.2-.6 2-2 2 1.4 0 2 .8 2 2v1.5c0 2 1 3 3 3M19.5 9.5c2 0 3 1 3 3v1.5c0 1.2.6 2 2 2-1.4 0-2 .8-2 2v1.5c0 2-1 3-3 3"
        fill="none"
        stroke="#fff"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  );
}

export function GitHubIcon(props: IconProps) {
  return (
    <svg class={['icon', props.class]} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.46-1.1-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"
      />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icon>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </Icon>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </Icon>
  );
}

export function HashIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />
    </Icon>
  );
}

export function CycleIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M20 12a8 8 0 0 1-14.3 4.9M4 12A8 8 0 0 1 18.3 7.1" />
      <path d="M18 3v4.5h-4.5M6 21v-4.5h4.5" />
    </Icon>
  );
}

export function StreamIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M3 7h10M3 12h14M3 17h7" />
      <path d="m17 14 4-2-4-2" />
    </Icon>
  );
}

export function BracesIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M8 4c-2 0-3 1-3 3v2c0 1.5-.7 2.5-2 3 1.3.5 2 1.5 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5.7 2.5 2 3-1.3.5-2 1.5-2 3v2c0 2-1 3-3 3" />
    </Icon>
  );
}

export function PlugIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </Icon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M7 5v14l11-7z" />
    </Icon>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </Icon>
  );
}

export function ReturnIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M20 5v6a3 3 0 0 1-3 3H5M9 10l-4 4 4 4" />
    </Icon>
  );
}

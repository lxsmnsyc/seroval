import type { JSX } from '@solidjs/web';

type IconProps = { class?: string };

function Icon(props: IconProps & { children: JSX.Element }): JSX.Element {
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

/** The seroval mark, the same braces as the favicon. */
export function LogoMark(props: IconProps): JSX.Element {
  return (
    <svg class={['logo-mark', props.class]} viewBox="0 0 32 32" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="8"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      />
      <text
        x="16"
        y="21.5"
        font-family="'Martian Mono', ui-monospace, monospace"
        font-size="15"
        font-weight="600"
        fill="currentColor"
        text-anchor="middle"
      >
        {'{}'}
      </text>
    </svg>
  );
}

export function SearchIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </Icon>
  );
}

export function GithubIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </Icon>
  );
}

export function FileIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" />
    </Icon>
  );
}

export function HashIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </Icon>
  );
}

export function PlayIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M6 3v18l14-9Z" />
    </Icon>
  );
}

export function ShareIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Icon>
  );
}

export function ReturnIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M9 10l-5 5 5 5" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </Icon>
  );
}

export function UpDownIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function CircleXIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </Icon>
  );
}

export function CircleAlertIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </Icon>
  );
}

export function LoaderIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class ? `spin ${props.class}` : 'spin'}>
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </Icon>
  );
}

export function ResetIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </Icon>
  );
}

export function SunIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Icon>
  );
}

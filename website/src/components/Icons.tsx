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

export function LogoMark(props: IconProps): JSX.Element {
  return (
    <svg class={['logo-mark', props.class]} viewBox="0 0 32 32" aria-hidden="true">
      <rect x=".5" y=".5" width="31" height="31" rx="6" fill="none" stroke="currentColor" />
      <text
        x="16"
        y="21.5"
        font-family="'Geist Mono Variable', ui-monospace, monospace"
        font-size="15"
        font-weight="500"
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
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icon>
  );
}

export function EditIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </Icon>
  );
}

export function FileIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </Icon>
  );
}

export function HashIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />
    </Icon>
  );
}

export function PlayIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M7 5v14l11-7z" />
    </Icon>
  );
}

export function ShareIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </Icon>
  );
}

export function ReturnIcon(props: IconProps): JSX.Element {
  return (
    <Icon class={props.class}>
      <path d="M20 5v6a3 3 0 0 1-3 3H5M9 10l-4 4 4 4" />
    </Icon>
  );
}

import type { ButtonHTMLAttributes, Ref } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

/**
 * The one button of the interface (#544, ADR-032): one look, whether a
 * `<button>` or a link is underneath, and never underlined. A screen draws an
 * action with `Button`, or with `ButtonLink` when the action goes somewhere,
 * and never by writing the classes by hand.
 *
 * - `primary`: the one action of a screen that deserves the blue of the brand.
 * - `quiet`: everything beside it, the surface with an edge.
 * - `danger`: what destroys, red in its label; `confirming` is the question
 *   already asked, where the red reaches its edge.
 * - `bar`: a quiet button of a notebook's bar, set tighter.
 */
export type ButtonVariant = 'primary' | 'quiet' | 'danger' | 'bar';

export interface ButtonLook {
  variant?: ButtonVariant;
  /** Inside a row of a list, where the row is the subject and the action is not. */
  small?: boolean;
  /** As wide as the form whose one action it is. */
  wide?: boolean;
  /** A `danger` button in a confirmation. */
  confirming?: boolean;
  className?: string;
}

/** The classes of a look: the one place they are written. */
export function buttonClass({
  variant = 'quiet',
  small = false,
  wide = false,
  confirming = false,
  className,
}: ButtonLook): string {
  return [
    'button',
    variant === 'bar' ? 'is-quiet is-bar' : `is-${variant}`,
    small && 'is-small',
    wide && 'is-wide',
    confirming && variant === 'danger' && 'is-filled',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = ButtonLook &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & { ref?: Ref<HTMLButtonElement> };

export function Button({
  variant,
  small,
  wide,
  confirming,
  className,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, small, wide, confirming, className })}
      {...rest}
    />
  );
}

type ButtonLinkProps = ButtonLook & Omit<LinkProps, 'className'> & { ref?: Ref<HTMLAnchorElement> };

export function ButtonLink({
  variant,
  small,
  wide,
  confirming,
  className,
  ref,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      ref={ref}
      className={buttonClass({ variant, small, wide, confirming, className })}
      {...rest}
    />
  );
}

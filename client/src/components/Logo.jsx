/**
 * Reusable Apostolic Faith Church branding.
 *
 * Logo files live in client/public/:
 *   africa-for-christ.png   – primary mark (used everywhere)
 *   jesus-light-world.png   – wordmark (used on hero/success pages)
 */

export const AFC_LOGO   = '/africa-for-christ.png';
export const JESUS_MARK = '/jesus-light-world.png';
export const CHURCH_NAME = 'Apostolic Faith Church';

export default function Logo({ size = 36, withName = true, color = 'currentColor' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.6rem' }}>
      <img
        src={AFC_LOGO}
        alt="Apostolic Faith Church – Africa For Christ"
        width={size}
        height={size}
        style={{ display: 'block', objectFit: 'contain' }}
      />
      {withName && (
        <span style={{
          color,
          fontWeight: 700,
          fontSize: size >= 40 ? '1.05rem' : '1rem',
          letterSpacing: '.01em',
          lineHeight: 1.1,
        }}>
          {CHURCH_NAME}
        </span>
      )}
    </span>
  );
}

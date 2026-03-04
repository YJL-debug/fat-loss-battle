export default function Avatar({ nickname, avatar, size = 'md' }: {
  nickname: string;
  avatar?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-14 h-14 text-xl',
  };

  if (avatar) {
    return (
      <div className={`${sizes[size]} rounded-full bg-gray-50 flex items-center justify-center shrink-0`}>
        {avatar}
      </div>
    );
  }

  return (
    <div className={`${sizes[size]} rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold shrink-0`}>
      {nickname?.charAt(0)}
    </div>
  );
}

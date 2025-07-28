import React from 'react';
import { getAvatarUrl } from './avatarUtils';

interface AvatarProps {
  user: {
    avatar?: string;
    nickname?: string;
    email: string;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ user, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-16 h-16'
  };

  const avatarUrl = getAvatarUrl(user);

  return (
    <img
      src={avatarUrl}
      alt={`${user.nickname || user.email}'s avatar`}
      className={`${sizeClasses[size]} rounded-full flex-shrink-0 ${className}`}
      onError={(e) => {
        // Fallback to default avatar if image fails to load
        const target = e.target as HTMLImageElement;
        target.src = getAvatarUrl({ email: user.email, nickname: user.nickname });
      }}
    />
  );
};

export default Avatar;

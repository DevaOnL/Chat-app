import React from 'react';

interface Group {
  _id: string;
  name: string;
  description?: string;
  members: string[];
  admins: string[];
  creator: string;
  avatar?: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GroupAvatarProps {
  group: Group;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const GroupAvatar: React.FC<GroupAvatarProps> = ({ group, size = 'md', className = '' }) => {
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  };

  // Generate initials from group name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate a consistent color based on group ID
  const getColorFromId = (id: string) => {
    const colors = [
      'bg-red-500',
      'bg-blue-500', 
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500'
    ];
    
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  if (group.avatar) {
    return (
      <img
        src={group.avatar}
        alt={`${group.name} avatar`}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-border ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full ${getColorFromId(group._id)} 
        flex items-center justify-center text-white font-medium border-2 border-border ${className}`}
    >
      {getInitials(group.name)}
    </div>
  );
};

export default GroupAvatar;
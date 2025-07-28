// Simple avatar utilities
export const generateDefaultAvatar = (name: string): string => {
  // Get initials from name (nickname or email)
  const initials = name
    .split(/[^a-zA-Z]/) // Split on non-letters
    .filter(word => word.length > 0)
    .slice(0, 2) // Take first 2 words
    .map(word => word[0].toUpperCase())
    .join('');

  // Generate a consistent color based on the name
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  const backgroundColor = colors[colorIndex];

  // Create SVG avatar
  const svg = `
    <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" fill="${backgroundColor}" rx="20"/>
      <text x="20" y="28" font-family="Arial, sans-serif" font-size="16" font-weight="bold" 
            text-anchor="middle" fill="white">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const getAvatarUrl = (user: { avatar?: string; nickname?: string; email: string }): string => {
  if (user.avatar) {
    return user.avatar;
  }
  
  // Generate default avatar using nickname or email
  const name = user.nickname || user.email;
  return generateDefaultAvatar(name);
};

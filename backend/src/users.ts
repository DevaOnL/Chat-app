// src/users.ts
export interface User {
  id: string;
  email: string;
  password: string; // hashed
  nickname?: string;
  createdAt: number;
}

// In-memory user store
const users: User[] = [];

export const createUser = (user: User): void => {
  users.push(user);
};

export const findUserByEmail = (email: string): User | undefined => {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
};

export const findUserById = (id: string): User | undefined => {
  return users.find(u => u.id === id);
};

export const getAllUsers = (): User[] => {
  return users;
};

export const updateUserNickname = (id: string, nickname: string): boolean => {
  const user = findUserById(id);
  if (user) {
    user.nickname = nickname;
    return true;
  }
  return false;
};

// For debugging (optional)
export const getUserCount = (): number => {
  return users.length;
};
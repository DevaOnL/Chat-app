import React, { useState } from 'react';

interface User {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
}

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

interface GroupInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  currentUser: User;
  onMemberAdded: (memberEmail: string) => void;
}

const GroupInviteModal: React.FC<GroupInviteModalProps> = ({
  isOpen,
  onClose,
  group,
  currentUser,
  onMemberAdded
}) => {
  const [memberEmail, setMemberEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!memberEmail.trim()) {
      setError('Email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(memberEmail.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    // Check if user is already a member
    if (group.members.includes(memberEmail.trim().toLowerCase())) {
      setError('User is already a member of this group');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${group._id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          memberEmail: memberEmail.trim().toLowerCase()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add member');
      }

      const result = await response.json();
      onMemberAdded(memberEmail.trim().toLowerCase());
      setSuccess(`Successfully added ${memberEmail} to the group`);
      setMemberEmail('');
      
      // Auto close after success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error adding member:', error);
      setError(error instanceof Error ? error.message : 'Failed to add member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setMemberEmail('');
      setError(null);
      setSuccess(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-panel border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-fg">Add Member to {group.name}</h3>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-muted hover:text-fg transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          <div>
            <label htmlFor="memberEmail" className="block text-sm font-medium text-fg mb-2">
              User Email
            </label>
            <input
              type="email"
              id="memberEmail"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-input text-fg 
                placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Enter user's email address"
              disabled={isLoading}
              required
            />
            <p className="text-xs text-muted mt-1">
              Enter the email address of the user you want to add to the group.
            </p>
          </div>

          <div className="bg-panelAlt p-3 rounded-md">
            <h4 className="text-sm font-medium text-fg mb-2">Group Information</h4>
            <div className="text-xs text-muted space-y-1">
              <div>Members: {group.members.length}</div>
              <div>Type: {group.isPrivate ? 'Private' : 'Public'}</div>
              {group.description && (
                <div>Description: {group.description}</div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-muted hover:text-fg border border-border 
                rounded-md hover:bg-panelAlt transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !memberEmail.trim()}
              className="px-4 py-2 text-sm bg-accent text-accentFore rounded-md 
                hover:bg-accentAlt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroupInviteModal;
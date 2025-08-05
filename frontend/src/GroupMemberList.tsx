import React, { useState, useEffect } from 'react';
import Avatar from './Avatar';

interface User {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
}

interface GroupMember {
  email: string;
  nickname?: string;
  avatar?: string;
  isAdmin: boolean;
  isCreator: boolean;
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

interface GroupMemberListProps {
  group: Group;
  currentUser: User;
  onMemberRemoved?: (memberEmail: string) => void;
  onMemberRoleChanged?: (memberEmail: string, role: 'admin' | 'member') => void;
}

const GroupMemberList: React.FC<GroupMemberListProps> = ({
  group,
  currentUser,
  onMemberRemoved,
  onMemberRoleChanged
}) => {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCurrentUserAdmin = group.admins.includes(currentUser.email);
  const isCurrentUserCreator = group.creator === currentUser.email;

  useEffect(() => {
    fetchMembers();
  }, [group._id]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${group._id}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch group members');
      }

      const result = await response.json();
      setMembers(result.data);
    } catch (error) {
      console.error('Error fetching group members:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberEmail: string) => {
    if (!isCurrentUserAdmin || memberEmail === group.creator) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${group._id}/members/${encodeURIComponent(memberEmail)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove member');
      }

      // Update local state
      setMembers(prev => prev.filter(member => member.email !== memberEmail));
      
      if (onMemberRemoved) {
        onMemberRemoved(memberEmail);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove member');
    }
  };

  const handleRoleChange = async (memberEmail: string, newRole: 'admin' | 'member') => {
    if (!isCurrentUserAdmin || memberEmail === group.creator) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/groups/${group._id}/members/${encodeURIComponent(memberEmail)}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) {
        throw new Error('Failed to update member role');
      }

      // Update local state
      setMembers(prev => prev.map(member => 
        member.email === memberEmail 
          ? { ...member, isAdmin: newRole === 'admin' }
          : member
      ));

      if (onMemberRoleChanged) {
        onMemberRoleChanged(memberEmail, newRole);
      }
    } catch (error) {
      console.error('Error updating member role:', error);
      setError(error instanceof Error ? error.message : 'Failed to update member role');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-fg mb-3">
        Members ({members.length})
      </h4>
      
      {members.map((member) => {
        const userForAvatar = {
          id: member.email, // Using email as ID for avatar
          email: member.email,
          nickname: member.nickname || member.email,
          avatar: member.avatar
        };

        return (
          <div key={member.email} className="flex items-center justify-between p-2 rounded-lg hover:bg-panelAlt">
            <div className="flex items-center space-x-3">
              <Avatar user={userForAvatar} size="sm" />
              <div>
                <div className="text-sm font-medium text-fg">
                  {member.nickname || member.email}
                  {member.email === currentUser.email && (
                    <span className="text-xs text-muted ml-1">(You)</span>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {member.isCreator ? 'Creator' : member.isAdmin ? 'Admin' : 'Member'}
                </div>
              </div>
            </div>

            {/* Actions for admins */}
            {isCurrentUserAdmin && member.email !== group.creator && member.email !== currentUser.email && (
              <div className="flex items-center space-x-2">
                <select
                  value={member.isAdmin ? 'admin' : 'member'}
                  onChange={(e) => handleRoleChange(member.email, e.target.value as 'admin' | 'member')}
                  className="text-xs bg-input border border-border rounded px-2 py-1 text-fg"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                
                <button
                  onClick={() => handleRemoveMember(member.email)}
                  className="text-red-500 hover:text-red-600 text-xs p-1"
                  title="Remove member"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Leave option for current user (if not creator) */}
            {member.email === currentUser.email && !member.isCreator && (
              <button
                onClick={() => handleRemoveMember(member.email)}
                className="text-red-500 hover:text-red-600 text-xs px-2 py-1 border border-red-500 rounded"
              >
                Leave Group
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default GroupMemberList;